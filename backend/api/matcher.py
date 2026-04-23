from math import radians, sin, cos, sqrt, atan2
from .models import Provider, ServiceRequest, ProviderMatch, VerificationAuditLog, SystemSettings
from django.db.models import Avg

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in kilometers
    lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

def run_matcher_engine(request: ServiceRequest):
    """
    ServeFlow Autonomous Matcher Engine v2.0
    Weighted Heuristic Scoring.
    """
    # 1. Candidate Filtering (SAME CATEGORY ONLY)
    if not request.ai_category:
        return []

    candidates = Provider.objects.filter(
        categories=request.ai_category,
        availability_status='available',
        user__is_email_verified=True
    )
    if getattr(SystemSettings.get_settings(), "require_provider_verification", True):
        candidates = candidates.filter(verification_status='verified')

    matches = []
    
    for provider in candidates:
        # TrustScore (25%) - From latest approved audit
        audit = VerificationAuditLog.objects.filter(bundle__provider=provider, decision='APPROVED').order_by('-decided_at').first()
        trust_score = audit.trust_score if audit else 0
        normalized_trust = (trust_score / 100.0) * 25

        # Reputation (25%) - Provider Rating
        rating = float(provider.rating or 0)
        normalized_rep = (rating / 5.0) * 25

        # Proximity (30%)
        distance = 0
        prox_score = 0
        if request.latitude and request.longitude and provider.user.profile.latitude:
            distance = calculate_distance(
                request.latitude, request.longitude,
                provider.user.profile.latitude, provider.user.profile.longitude
            )
            # 0km = 30 pts, 50km = 0 pts
            prox_score = max(0, 30 * (1 - (distance / 50.0)))

        # Pulse Bonus (20%)
        # Urgency: IMMEDIATE = 10 pts, STANDARD = 0 pts
        # Distance proximity bonus (< 5km) = 10 pts
        pulse_bonus = 0
        if request.urgency == 'IMMEDIATE':
            pulse_bonus += 10
        if distance < 5:
            pulse_bonus += 10

        total_score = normalized_trust + normalized_rep + prox_score + pulse_bonus
        
        # Save Match for persistence and audit
        match, _ = ProviderMatch.objects.update_or_create(
            request=request,
            provider=provider,
            defaults={
                'total_score': total_score,
                'affinity_score': normalized_trust + normalized_rep, # combined static traits
                'proximity_score': prox_score,
                'reputation_score': normalized_rep,
                'pulse_bonus': pulse_bonus,
                'distance_km': distance
            }
        )
        matches.append(match)

    # Sort and notify top matches in next turn (via Celery)
    matches.sort(key=lambda x: x.total_score, reverse=True)
    return matches[:10]
