from celery import shared_task
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
import logging

from .emails import get_smtp_connection, merge_smtp_config, render_email, smtp_is_configured
from .models import ServiceRequest, Category, RateCard, VerificationCase
from .matcher import run_matcher_engine
from .verification import run_ai_verification

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_otp_email(self, email, otp):
    """
    Send 6-digit OTP email via SMTP (SystemSettings + env).
    Check api_emailog in admin if delivery fails.
    """
    if not getattr(settings, 'ENABLE_EMAIL_OTP', True):
        logger.info(f"OTP email skipped for {email} (ENABLE_EMAIL_OTP=False). Code: {otp}")
        return

    subject = f'Your ServeFlow verification code: {otp}'
    context = {
        'otp': otp,
        'expiry_minutes': getattr(settings, 'OTP_EXPIRY_SECONDS', 600) // 60
    }

    try:
        from .models import SystemSettings, EmailLog

        html_content, text_content = render_email('otp_email', context)
        sys_settings = SystemSettings.get_settings()
        smtp_host, smtp_port, smtp_user, smtp_password, use_tls, final_from_email = merge_smtp_config(
            sys_settings
        )

        if not smtp_is_configured(sys_settings):
            logger.warning(
                "No SMTP credentials configured — OTP for %s will only appear in console/logs. "
                "Run: python manage.py sync_credentials_file --force",
                email,
            )
        else:
            logger.info("Using SMTP: %s:%s", smtp_host or settings.EMAIL_HOST, smtp_port)
        connection = get_smtp_connection(sys_settings)

        msg = EmailMultiAlternatives(
            subject, text_content, final_from_email, [email], connection=connection
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info("OTP email sent to %s via SMTP", email)

        EmailLog.objects.create(
            recipient_email=email,
            subject=subject,
            content=text_content,
            success=True
        )

    except Exception as exc:
        from celery.exceptions import Retry
        if isinstance(exc, Retry):
            raise

        from .models import EmailLog
        EmailLog.objects.create(
            recipient_email=email,
            subject=subject,
            content=f"FAILED. OTP: {otp}\nError: {str(exc)}",
            success=False,
            error_message=str(exc)
        )

        error_str = str(exc)
        logger.error("Error in send_otp_email for %s: %s", email, error_str)

        if any(err in error_str.lower() for err in ["timeout", "connection", "500", "502", "503", "504"]):
            raise self.retry(exc=exc)


def dispatch_otp_email(email: str, otp: str) -> bool:
    """
    Deliver OTP synchronously when Celery eager (Docker dev / tests), else queue.
    Returns True when send finished in-process (EmailLog is immediately available).
    """
    if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
        send_otp_email.apply(args=[email, otp])
        return True
    send_otp_email.delay(email, otp)
    return False


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
