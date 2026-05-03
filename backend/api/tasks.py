import os
from email.utils import parseaddr

from celery import shared_task
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import logging
import requests
from .models import ServiceRequest, Category, RateCard, VerificationCase
from .matcher import run_matcher_engine
from .verification import run_ai_verification

logger = logging.getLogger(__name__)


def _merge_otp_mail_config(sys_settings):
    """
    DB SystemSettings first, then Space/process env (HF secrets often only hit env).
    """
    smtp_host = (sys_settings.smtp_host or "").strip() or (
        os.environ.get("SMTP_HOST") or os.environ.get("EMAIL_HOST") or ""
    ).strip()
    port_raw = sys_settings.smtp_port
    if port_raw is None:
        pr = os.environ.get("SMTP_PORT") or os.environ.get("EMAIL_PORT")
        smtp_port = int(pr) if pr else 587
    else:
        smtp_port = int(port_raw)
    smtp_user = (sys_settings.smtp_user or "").strip() or (
        os.environ.get("SMTP_USER") or os.environ.get("EMAIL_HOST_USER") or ""
    ).strip()
    smtp_password = (sys_settings.smtp_password or "").strip() or (
        os.environ.get("SENDGRID_API_KEY")
        or os.environ.get("EMAIL_HOST_PASSWORD")
        or os.environ.get("SMTP_PASSWORD")
        or ""
    ).strip()
    use_tls = sys_settings.smtp_use_tls
    if os.environ.get("EMAIL_USE_TLS") is not None:
        use_tls = os.environ.get("EMAIL_USE_TLS", "True").lower() == "true"
    elif os.environ.get("SMTP_USE_TLS") is not None:
        use_tls = os.environ.get("SMTP_USE_TLS", "True").lower() == "true"
    from_display = (
        (sys_settings.from_email or "").strip()
        or os.environ.get("DEFAULT_FROM_EMAIL", "").strip()
        or settings.DEFAULT_FROM_EMAIL
    )
    return smtp_host, smtp_port, smtp_user, smtp_password, use_tls, from_display


def _sendgrid_from_payload(from_display):
    """SendGrid v3 requires bare email in from.email; 'Name <email>' must be split."""
    name, addr = parseaddr(from_display)
    addr = (addr or "").strip()
    if not addr and "@" in (from_display or ""):
        addr = from_display.strip()
    if not addr:
        addr = "noreply@serveflow.ai"
    out = {"email": addr}
    if name and name.strip():
        out["name"] = name.strip()
    return out


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_otp_email(self, email, otp):
    """
    Send 6-digit OTP email to user using professional HTML/Plain-text template.

    Hugging Face / production: set Space secrets, e.g. SMTP_HOST=smtp.sendgrid.net,
    SENDGRID_API_KEY=REDACTED_SENDGRID_KEY (sync maps to smtp_user=apikey + password), DEFAULT_FROM_EMAIL
    (verified sender). Use SYNC_SETTINGS_FROM_ENV_FORCE=true or HF_SYNC_SETTINGS_FROM_ENV=true
    once so env overwrites stale DB values. Check api_emailog in admin if delivery fails.
    """
    # Check if OTP is globally enabled
    if not getattr(settings, 'ENABLE_EMAIL_OTP', False):
        logger.info(f"OTP email skipped for {email} (ENABLE_EMAIL_OTP=False). Code: {otp}")
        return

    subject = f'Your ServeFlow verification code: {otp}'
    from_email = settings.DEFAULT_FROM_EMAIL
    
    # Context for template
    context = {
        'otp': otp,
        'expiry_minutes': getattr(settings, 'OTP_EXPIRY_SECONDS', 600) // 60
    }
    
    try:
        from django.core.mail import get_connection
        from .models import SystemSettings, EmailLog
        
        # Render templates
        html_content = render_to_string('emails/otp_email.html', context)
        text_content = render_to_string('emails/otp_email.txt', context)
        
        sys_settings = SystemSettings.get_settings()
        smtp_host, smtp_port, smtp_user, smtp_password, use_tls, final_from_email = _merge_otp_mail_config(
            sys_settings
        )

        # SendGrid Web API (Bearer) or SMTP: apikey + SG.* ; legacy Twilio/SK basic auth
        host_l = (smtp_host or "").lower()
        is_sendgrid = (
            smtp_user == "apikey"
            or "sendgrid" in host_l
            or (smtp_password and str(smtp_password).startswith("SG."))
            or (smtp_user and str(smtp_user).startswith("SK"))
        )

        if is_sendgrid:
            url = "https://api.sendgrid.com/v3/mail/send"

            # Handle different auth types
            if smtp_user and smtp_user.startswith("SK"):
                from requests.auth import HTTPBasicAuth

                auth = HTTPBasicAuth(smtp_user, smtp_password)
                headers = {"Content-Type": "application/json"}
            else:
                auth = None
                headers = {
                    "Authorization": f"Bearer {smtp_password}",
                    "Content-Type": "application/json",
                }

            data = {
                "personalizations": [{"to": [{"email": email}]}],
                "from": _sendgrid_from_payload(final_from_email),
                "subject": subject,
                "content": [
                    {"type": "text/plain", "value": text_content},
                    {"type": "text/html", "value": html_content},
                ],
            }
            res = requests.post(url, json=data, headers=headers, auth=auth, timeout=10)
            res.raise_for_status()
            logger.info(f"OTP email sent to {email} via SendGrid Web API")
        else:
            # Fallback to SMTP
            if not smtp_user and not getattr(settings, "EMAIL_HOST_USER", ""):
                logger.info("No SMTP user in settings or env, using default Django connection.")
                connection = get_connection()
            else:
                logger.info(f"Using SMTP: {smtp_host or settings.EMAIL_HOST}:{smtp_port}")
                connection = get_connection(
                    host=smtp_host or settings.EMAIL_HOST,
                    port=smtp_port or settings.EMAIL_PORT,
                    username=smtp_user or settings.EMAIL_HOST_USER,
                    password=smtp_password or settings.EMAIL_HOST_PASSWORD,
                    use_tls=use_tls,
                    timeout=10,
                )

            msg = EmailMultiAlternatives(subject, text_content, final_from_email, [email], connection=connection)
            msg.attach_alternative(html_content, "text/html")
            msg.send()
            logger.info(f"OTP email sent to {email} via SMTP")

        # Log success to DB
        EmailLog.objects.create(
            recipient_email=email,
            subject=subject,
            content=text_content,
            success=True
        )

    except Exception as exc:
        # Avoid logging the Retry exception itself as an error
        from celery.exceptions import Retry
        if isinstance(exc, Retry):
            raise
            
        from .models import EmailLog
        # Log failure to DB so OTP can still be retrieved
        EmailLog.objects.create(
            recipient_email=email,
            subject=subject,
            content=f"FAILED. OTP: {otp}\nError: {str(exc)}",
            success=False,
            error_message=str(exc)
        )
        
        error_str = str(exc)
        # Specific hint for 401
        if "401" in error_str:
            logger.error(f"CRITICAL: SendGrid/Twilio keys are UNAUTHORIZED (401). Please update to an SG. key.")
            # Do NOT retry on 401, it's a permanent failure
            return
        
        logger.error(f"Error in send_otp_email for {email}: {error_str}")
        
        # Only retry if it's not a permanent error
        if any(err in error_str.lower() for err in ["timeout", "connection", "500", "502", "503", "504"]):
            raise self.retry(exc=exc)
        else:
            # For other errors, don't retry (it just causes 500s in eager mode)
            pass

@shared_task(bind=True, max_retries=3)
def process_service_request(self, request_id):
    """
    Pillar A Orchestrator: Ingestion -> AI Analysis -> Enrichment -> Matching.
    """
    try:
        service_req = ServiceRequest.objects.get(id=request_id)
        service_req.status = 'OPEN' # Or 'ANALYZING' if we added it
        service_req.save()

        # 1. AI Analysis & Category Enrichment
        # This calls Gemini to figure out what the user wants
        from .verification import run_ai_analysis
        ai_data = run_ai_analysis(service_req.description)
        
        if ai_data:
            service_req.ai_summary = ai_data.get('summary')
            # Try to match category
            cat_name = ai_data.get('category')
            if cat_name:
                category = Category.objects.filter(name__icontains=cat_name).first()
                if category:
                    service_req.category = category
            service_req.save()

        # 2. Matcher Engine
        # Find the best providers
        run_matcher_engine(service_req)
        
        logger.info(f"Successfully processed service request #{request_id}")
        
    except Exception as exc:
        logger.error(f"Failed to process service request #{request_id}: {str(exc)}")
        raise self.retry(exc=exc)

@shared_task(bind=True, max_retries=5)
def process_verification_case(self, case_id):
    """
    Pillar B: AI Verification of Provider Documents
    """
    try:
        case = VerificationCase.objects.get(id=case_id)
        case.status = 'UNDER_REVIEW'
        case.save()

        # Call the AI Verification logic
        result = run_ai_verification(case)
        
        # Update case with results
        case.status = 'VERIFIED' if result['approved'] else 'REJECTED'
        case.ai_notes = result['notes']
        case.save()
        
        # Notify provider
        from .notifications import notify_user
        notify_user(case.provider.user, {
            'type': 'VERIFICATION_UPDATE',
            'message': f"Your verification status has been updated to: {case.status}",
            'decision': case.status,
        })
    except Exception as exc:
        logger.error(f"Failed verification case #{case_id}: {str(exc)}")
        raise self.retry(exc=exc)
