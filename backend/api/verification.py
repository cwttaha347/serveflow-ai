import requests
from django.conf import settings
from .models import VerificationBundle, VerificationAuditLog, VerificationCase
from django.utils import timezone

def run_ai_verification(bundle: VerificationBundle):
    """
    Call FastAPI service to run multimodal verification LangGraph.
    """
    files = {
        'id_front': bundle.id_front,
        'id_back': bundle.id_back,
        'selfie': bundle.selfie_with_id,
    }
    if bundle.certificate:
        files['certificate'] = bundle.certificate

    try:
        # Assuming FastAPI has an endpoint that takes these files 
        # (We'll update FastAPI main.py to handle this orchestration)
        ai_service_url = getattr(settings, "AI_SERVICE_URL", "http://ai_service:8001").rstrip("/")
        response = requests.post(f"{ai_service_url}/ai/verify-provider", files=files, timeout=60)
        response.raise_for_status()
        data = response.json()
        
        trust_score = data.get('trust_score', 0)
        
        # Hybrid decisioning logic for production queue.
        if trust_score >= 92:
            decision = 'AUTO_APPROVED'
        elif trust_score <= 35:
            decision = 'AUTO_REJECTED'
        else:
            decision = 'REVIEW_REQUIRED'
            
        # Create Audit Log
        audit = VerificationAuditLog.objects.create(
            bundle=bundle,
            trust_score=trust_score,
            id_score=data.get('id_results', {}).get('authenticity_score', 0) * 100,
            liveness_score=data.get('liveness_results', {}).get('liveness_score', 0) * 100,
            cert_score=data.get('cert_results', {}).get('cert_score', 0) * 100 if data.get('cert_results') else None,
            decision='APPROVED' if decision == 'AUTO_APPROVED' else ('REJECTED' if decision == 'AUTO_REJECTED' else 'CONDITIONAL'),
            gemini_raw=data
        )
        
        # Update Bundle
        if decision == 'AUTO_APPROVED':
            bundle.status = 'APPROVED'
        elif decision == 'AUTO_REJECTED':
            bundle.status = 'REJECTED'
        else:
            bundle.status = 'UNDER_REVIEW'
        bundle.save()
        
        # Update Provider
        provider = bundle.provider
        if decision == 'AUTO_APPROVED':
            provider.verification_status = 'verified'
            provider.verified = True
            provider.verification_date = timezone.now()
        elif decision == 'AUTO_REJECTED':
            provider.verification_status = 'rejected'
            provider.verified = False
        else:
            provider.verification_status = 'under_review'
        provider.save()

        VerificationCase.objects.filter(bundle=bundle).update(
            status=decision,
            confidence_score=trust_score,
            risk_score=max(0.0, 100.0 - float(trust_score)),
            reason=str(data.get('summary') or data.get('reason') or ''),
        )
        
        return audit
    except Exception as e:
        bundle.status = 'PENDING' # Reset on error
        bundle.save()
        raise e
