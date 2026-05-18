import os

from django.core.mail import get_connection, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

SMTP_EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"


def merge_smtp_config(sys_settings=None):
    """
    DB SystemSettings first, then process env (SMTP_HOST, SMTP_USER, etc.).
    SMTP only — no third-party mail APIs.
    """
    from .models import SystemSettings

    if sys_settings is None:
        sys_settings = SystemSettings.get_settings()

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
        os.environ.get("EMAIL_HOST_PASSWORD")
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
    # Gmail and most SMTP providers require From to match the authenticated mailbox.
    if smtp_user and (
        not from_display
        or "noreply@" in from_display.lower()
        or "@serveflow.ai" in from_display.lower()
    ):
        from_display = f"ServeFlow AI <{smtp_user}>"
    return smtp_host, smtp_port, smtp_user, smtp_password, use_tls, from_display


def smtp_is_configured(sys_settings=None):
    host, _, user, password, _, _ = merge_smtp_config(sys_settings)
    env_user = (getattr(settings, "EMAIL_HOST_USER", "") or "").strip()
    env_pass = (getattr(settings, "EMAIL_HOST_PASSWORD", "") or "").strip()
    return bool((user and password) or (env_user and env_pass) or (host and env_user))


def get_smtp_connection(sys_settings=None):
    """SMTP connection using DB/env credentials; explicit backend (not console)."""
    from .models import SystemSettings

    if sys_settings is None:
        sys_settings = SystemSettings.get_settings()

    host, port, user, password, use_tls, _ = merge_smtp_config(sys_settings)
    env_user = (getattr(settings, "EMAIL_HOST_USER", "") or "").strip()
    env_pass = (getattr(settings, "EMAIL_HOST_PASSWORD", "") or "").strip()
    username = user or env_user
    secret = password or env_pass

    if not username:
        logger.warning(
            "SMTP not configured — mail will print to the console only. "
            "Set credentials in Admin → System Settings or run: "
            "python manage.py sync_credentials_file --force"
        )
        return get_connection()

    return get_connection(
        backend=SMTP_EMAIL_BACKEND,
        host=host or settings.EMAIL_HOST,
        port=port or settings.EMAIL_PORT,
        username=username,
        password=secret,
        use_tls=use_tls,
        timeout=10,
    )


def render_email(template_base, context):
    """Render HTML and plain-text email pair from templates/emails/{template_base}.*"""
    from .branding import email_branding_context

    merged = email_branding_context(context)
    html = render_to_string(f"emails/{template_base}.html", merged)
    text = render_to_string(f"emails/{template_base}.txt", merged)
    return html, text


def get_resilient_connection(sys_settings=None):
    """SMTP connection from SystemSettings + env fallbacks."""
    return get_smtp_connection(sys_settings)


def send_resilient_mail(subject, message, recipient_list, html_message=None, log_context=None):
    """
    Wrapper around EmailMultiAlternatives using resilient connection.
    """
    from .models import SystemSettings
    sys_settings = SystemSettings.get_settings()
    _, _, _, _, _, from_email = merge_smtp_config(sys_settings)

    context = log_context or {}
    try:
        connection = get_resilient_connection(sys_settings)
        backend_name = getattr(connection, "__class__", type(connection)).__name__
        if not smtp_is_configured(sys_settings):
            logger.warning(
                "resilient_email using console backend flow=%s — configure SMTP or sync credentials.txt",
                context.get("flow", ""),
            )
        msg = EmailMultiAlternatives(
            subject, message, from_email, recipient_list, connection=connection
        )
        if html_message:
            msg.attach_alternative(html_message, "text/html")
        msg.send()
        logger.info(
            "resilient_email outcome=sent backend=%s recipients=%s flow=%s request_id=%s",
            backend_name,
            len(recipient_list or []),
            context.get("flow", ""),
            context.get("request_id", ""),
        )
        return True
    except Exception as e:
        logger.error(
            "resilient_email outcome=failed flow=%s request_id=%s error=%s",
            context.get("flow", ""),
            context.get("request_id", ""),
            str(e),
        )
        return False


def send_templated_mail(subject, template_base, context, recipient_list, log_context=None):
    """Render template pair and send via resilient mail."""
    html, text = render_email(template_base, context)
    return send_resilient_mail(
        subject, text, recipient_list, html_message=html, log_context=log_context
    )


def send_new_request_notification(request_obj):
    """
    Email admin + providers when new request created
    """
    subject = f"New {request_obj.category.name} Service Request"

    from .models import User, Provider

    admins = User.objects.filter(role="admin")
    admin_emails = [a.email for a in admins if a.email]

    providers = Provider.objects.filter(categories=request_obj.category)
    provider_emails = [p.user.email for p in providers if p.user.email]

    customer = request_obj.user
    context = {
        "category_name": request_obj.category.name,
        "title": request_obj.title,
        "description": request_obj.description,
        "budget": f"${request_obj.budget}" if request_obj.budget else "Not specified",
        "location": request_obj.address or "Not specified",
        "preferred_date": str(request_obj.preferred_date or "Flexible"),
        "customer_name": customer.get_full_name() or customer.username,
        "request_id": request_obj.id,
    }

    recipients = list(set(admin_emails + provider_emails))
    if recipients:
        send_templated_mail(
            subject,
            "new_request",
            context,
            recipients,
            log_context={"flow": "new_request", "request_id": request_obj.id},
        )


def send_job_status_notification(job, old_status, new_status):
    """
    Email customer when job status changes
    """
    customer_email = job.request.user.email
    if not customer_email:
        return

    customer = job.request.user
    context = {
        "customer_name": customer.get_full_name() or customer.username,
        "job_title": job.request.title,
        "provider_name": job.provider.user.get_full_name() or job.provider.user.username,
        "old_status": (old_status or "").upper(),
        "new_status": (new_status or "").upper(),
        "job_id": job.id,
        "request_id": job.request.id,
    }
    subject = f"Job Status Update: {job.request.title}"
    send_templated_mail(
        subject,
        "job_status",
        context,
        [customer_email],
        log_context={"flow": "job_status", "job_id": job.id},
    )


def send_bid_accepted_notification(bid):
    """
    Email provider when their bid is accepted
    """
    provider_email = bid.provider.user.email
    if not provider_email:
        return

    provider = bid.provider
    context = {
        "provider_name": provider.user.get_full_name() or provider.user.username,
        "request_title": bid.request_title,
        "bid_amount": bid.amount,
        "estimated_duration": bid.estimated_duration,
        "customer_name": bid.request.user.get_full_name() or bid.request.user.username,
        "location": bid.request.address or "Not specified",
        "bid_id": bid.id,
        "request_id": bid.request.id,
    }
    subject = f"Your Bid Was Accepted — {bid.request_title}"
    send_templated_mail(
        subject,
        "bid_accepted",
        context,
        [provider_email],
        log_context={"flow": "bid_accepted", "bid_id": bid.id},
    )


def send_new_bid_notification(bid):
    """
    Email customer when provider submits a bid
    """
    customer_email = bid.request.user.email
    if not customer_email:
        return

    customer = bid.request.user
    context = {
        "customer_name": customer.get_full_name() or customer.username,
        "request_title": bid.request_title,
        "provider_name": bid.provider_name,
        "provider_rating": bid.provider_rating or "N/A",
        "bid_amount": bid.amount,
        "estimated_duration": bid.estimated_duration,
        "proposal": bid.proposal,
        "bid_id": bid.id,
        "request_id": bid.request.id,
    }
    subject = f"New Bid Received — {bid.request_title}"
    send_templated_mail(
        subject,
        "bid_new",
        context,
        [customer_email],
        log_context={"flow": "bid_new", "bid_id": bid.id},
    )


def send_invoice_notification(invoice):
    """
    Email customer when invoice is generated
    """
    from .invoice_utils import invoice_email_context

    customer_email = invoice.job.request.user.email
    if not customer_email:
        return

    context = invoice_email_context(invoice)
    subject = f"Invoice — {invoice.job.request.title}"
    send_templated_mail(
        subject,
        "invoice",
        context,
        [customer_email],
        log_context={"flow": "invoice", "invoice_id": invoice.id},
    )


def send_invoice_paid_to_provider(invoice):
    """Email provider when customer pays an invoice."""
    from .invoice_utils import invoice_email_context

    provider_email = invoice.job.provider.user.email
    if not provider_email:
        return

    context = invoice_email_context(invoice)
    context["payment_status"] = "PAID"
    subject = f"Payment received — {invoice.job.request.title}"
    send_templated_mail(
        subject,
        "invoice_paid",
        context,
        [provider_email],
        log_context={"flow": "invoice_paid", "invoice_id": invoice.id},
    )


def send_password_reset_email(email, reset_link, user_name=None, log_context=None):
    """Password reset with HTML + plain text."""
    context = {
        "reset_link": reset_link,
        "user_name": user_name or "",
        "expiry_hours": 1,
    }
    subject = "Password Reset — ServeFlow AI"
    return send_templated_mail(
        subject,
        "password_reset",
        context,
        [email],
        log_context=log_context,
    )


def send_email_verification(email, verify_link, user_name=None):
    """Email verification link with HTML + plain text."""
    context = {
        "verify_link": verify_link,
        "user_name": user_name or "",
    }
    subject = "Verify your ServeFlow email"
    return send_templated_mail(
        subject,
        "email_verification",
        context,
        [email],
        log_context={"flow": "email_verification"},
    )
