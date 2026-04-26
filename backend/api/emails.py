from django.core.mail import get_connection, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)

def get_resilient_connection():
    """
    Utility to get a mail connection that respects SystemSettings.
    """
    from .models import SystemSettings
    sys_settings = SystemSettings.get_settings()
    
    if not sys_settings.smtp_user:
        return get_connection()
    
    return get_connection(
        host=sys_settings.smtp_host,
        port=sys_settings.smtp_port,
        username=sys_settings.smtp_user,
        password=sys_settings.smtp_password,
        use_tls=sys_settings.smtp_use_tls,
        timeout=10
    )

def send_resilient_mail(subject, message, recipient_list, html_message=None):
    """
    Wrapper around EmailMultiAlternatives using resilient connection.
    """
    from .models import SystemSettings
    sys_settings = SystemSettings.get_settings()
    from_email = sys_settings.from_email or settings.DEFAULT_FROM_EMAIL
    
    try:
        connection = get_resilient_connection()
        msg = EmailMultiAlternatives(subject, message, from_email, recipient_list, connection=connection)
        if html_message:
            msg.attach_alternative(html_message, "text/html")
        msg.send()
        return True
    except Exception as e:
        logger.error(f"Resilient email failed: {e}")
        return False

def send_new_request_notification(request_obj):
    """
    Email admin + providers when new request created
    """
    subject = f"🔔 New {request_obj.category.name} Service Request"
    
    # Get recipients
    from .models import User, Provider
    admins = User.objects.filter(role='admin')
    admin_emails = [a.email for a in admins if a.email]
    
    # Get providers in same category
    providers = Provider.objects.filter(categories=request_obj.category)
    provider_emails = [p.user.email for p in providers if p.user.email]
    
    # Create message
    message = f"""
New Service Request Received!

Category: {request_obj.category.name}
Title: {request_obj.title}
Description: {request_obj.description}
Budget: ${request_obj.budget or 'Not specified'}
Location: {request_obj.address}
Preferred Date: {request_obj.preferred_date}

Request ID: #{request_obj.id}
Customer: {request_obj.user.get_full_name() or request_obj.user.username}

---
This is an automated notification from ServeFlow AI.
    """
    
    recipients = list(set(admin_emails + provider_emails))  # Remove duplicates
    if recipients:
        send_resilient_mail(subject, message, recipients)


def send_job_status_notification(job, old_status, new_status):
    """
    Email customer when job status changes
    """
    customer_email = job.request.user.email
    if not customer_email:
        return
    
    status_emoji = {
        'pending': '⏳',
        'accepted': '✅',
        'started': '🚀',
        'completed': '🎉',
        'cancelled': '❌'
    }
    
    subject = f"{status_emoji.get(new_status, '📋')} Job Status Update: {job.request.title}"
    
    message = f"""
Hello {job.request.user.get_full_name() or job.request.user.username},

Your job status has been updated!

Job: {job.request.title}
Provider: {job.provider.user.get_full_name() or job.provider.user.username}

Status: {old_status.upper()} → {new_status.upper()}

Job ID: #{job.id}
Request ID: #{job.request.id}

---
This is an automated notification from ServeFlow AI.
    """
    send_resilient_mail(subject, message, [customer_email])


def send_bid_accepted_notification(bid):
    """
    Email provider when their bid is accepted
    """
    provider_email = bid.provider.user.email
    if not provider_email:
        return
    
    subject = f"🎉 Your Bid Was Accepted! - {bid.request_title}"
    
    message = f"""
Congratulations {bid.provider.user.get_full_name() or bid.provider.user.username}!

Your bid has been ACCEPTED by the customer!

Request: {bid.request_title}
Your Bid Amount: ${bid.amount}
Estimated Duration: {bid.estimated_duration}

Customer: {bid.request.user.get_full_name() or bid.request.user.username}
Location: {bid.request.address}

Next Steps:
1. Contact the customer to confirm details
2. Start the job as scheduled
3. Update job status when you start work

Bid ID: #{bid.id}
Request ID: #{bid.request.id}

---
This is an automated notification from ServeFlow AI.
    """
    send_resilient_mail(subject, message, [provider_email])


def send_new_bid_notification(bid):
    """
    Email customer when provider submits a bid
    """
    customer_email = bid.request.user.email
    if not customer_email:
        return
    
    subject = f"💰 New Bid Received - {bid.request_title}"
    
    message = f"""
Hello {bid.request.user.get_full_name() or bid.request.user.username},

You have received a new bid for your service request!

Request: {bid.request_title}
Provider: {bid.provider_name}
Rating: {bid.provider_rating or 'N/A'} ⭐

Bid Amount: ${bid.amount}
Estimated Duration: {bid.estimated_duration}

Proposal:
{bid.proposal}

You can review and accept/reject this bid from your dashboard.

Bid ID: #{bid.id}
Request ID: #{bid.request.id}

---
This is an automated notification from ServeFlow AI.
    """
    send_resilient_mail(subject, message, [customer_email])


def send_invoice_notification(invoice):
    """
    Email customer when invoice is generated
    """
    customer_email = invoice.job.request.user.email
    if not customer_email:
        return
    
    subject = f"📄 Invoice Generated - {invoice.job.request.title}"
    
    message = f"""
Hello {invoice.job.request.user.get_full_name() or invoice.job.request.user.username},

An invoice has been generated for your completed job.

Job: {invoice.job.request.title}
Provider: {invoice.job.provider.user.get_full_name()}

Invoice Details:
Subtotal: ${invoice.subtotal}
Tax: ${invoice.tax}
Discount: ${invoice.discount}
---
Total: ${invoice.total}

Status: {"PAID ✅" if invoice.paid else "PENDING ⏳"}

Invoice ID: #{invoice.id}
Job ID: #{invoice.job.id}

---
This is an automated notification from ServeFlow AI.
    """
    send_resilient_mail(subject, message, [customer_email])
