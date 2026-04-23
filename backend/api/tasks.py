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

@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_otp_email(self, email, otp):
    """
    Send 6-digit OTP email to user using professional HTML/Plain-text template.
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
        # Render templates
        # Note: These files will be created in the next step
        html_content = render_to_string('emails/otp_email.html', context)
        text_content = render_to_string('emails/otp_email.txt', context)
        
        msg = EmailMultiAlternatives(subject, text_content, from_email, [email])
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        
        logger.info(f"OTP email sent to {email}")
    except Exception as exc:
        logger.error(f"Error sending OTP email to {email}: {str(exc)}")
        raise self.retry(exc=exc)

@shared_task(bind=True, max_retries=3)
def process_service_request(self, request_id):
    """
    Pillar A Orchestrator: Ingestion -> AI Analysis -> Enrichment -> Matching.
    """
    try:
        service_req = ServiceRequest.objects.get(id=request_id)
        service_req.status = 'OPEN' # Or 'ANALYZING' if we added it
        service_req.save()

        # 1. Call AI Service (LangGraph Analysis)
        # Prepare multimodal payload
        files = {}
        for i, img_obj in enumerate(service_req.images.all()):
            files[f'file_{i}'] = img_obj.image

        ai_url = getattr(settings, 'AI_SERVICE_URL', 'http://ai_service:8001').rstrip('/') + '/ai/analyze-request-full'
        # For simplicity, we'll assume an endpoint that takes description + images
        # and returns the JSON specified in Section 1.3
        
        # Note: In a real implementation, we'd use a more robust HTTP call
        response = requests.post(
            ai_url, 
            data={'description': service_req.raw_description},
            files=files,
            timeout=120
        )
        response.raise_for_status()
        data = response.json()
        
        # 2. Update Model with AI Data
        service_req.ai_title = data.get('title', 'Service Request')
        service_req.severity_score = data.get('severity_score', 5)
        service_req.complexity = data.get('complexity', 'MEDIUM')
        service_req.urgency = 'IMMEDIATE' if data.get('urgency_flag') else 'STANDARD'
        service_req.est_duration_hrs = data.get('estimated_duration_hours', 2.0)
        service_req.ai_analysis_raw = data
        
        # Category Mapping
        cat_name = data.get('category')
        category = Category.objects.filter(name__iexact=cat_name).first()
        service_req.ai_category = category
        
        # 3. Normative Enrichment (RateCard Lookup)
        if category:
            rate_cols = RateCard.objects.filter(
                category=category,
                min_severity__lte=service_req.severity_score,
                max_severity__gte=service_req.severity_score
            ).first()
            
            if rate_cols:
                hourly = float(rate_cols.hourly_rate)
                base = float(rate_cols.base_fee)
                service_req.est_price_min = base + (hourly * service_req.est_duration_hrs * 0.9)
                service_req.est_price_max = base + (hourly * service_req.est_duration_hrs * 1.3)

        service_req.status = 'BIDDING'
        service_req.save()

        # 4. Trigger Matcher Engine
        run_matcher_engine(service_req)
        
        logger.info(f"Autonomous processing complete for Request #{request_id}")
        
    except Exception as exc:
        logger.error(f"Failed to process request #{request_id}: {str(exc)}")
        raise self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=3, default_retry_delay=20)
def process_verification_case(self, case_id):
    try:
        case = VerificationCase.objects.select_related('bundle', 'provider').get(id=case_id)
        if case.status not in ['SUBMITTED', 'PROCESSING', 'REVIEW_REQUIRED']:
            return {'case_id': case.id, 'status': case.status, 'skipped': True}
        case.status = 'PROCESSING'
        case.save(update_fields=['status', 'updated_at'])
        audit = run_ai_verification(case.bundle)
        case.refresh_from_db()
        return {
            'case_id': case.id,
            'status': case.status,
            'trust_score': audit.trust_score,
            'decision': case.status,
        }
    except Exception as exc:
        logger.error(f"Failed verification case #{case_id}: {str(exc)}")
        raise self.retry(exc=exc)
