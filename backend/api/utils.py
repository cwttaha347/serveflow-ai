import re
from math import radians, sin, cos, sqrt, atan2
from django.db.models import Q

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two points using Haversine formula.
    Returns distance in kilometers.
    """
    if not all([lat1, lon1, lat2, lon2]):
        return None
    
    R = 6371  # Earth radius in kilometers
    
    lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = R * c
    
    return round(distance, 2)

def calculate_match_score(request_obj, provider):
    """
    Calculate match score between request and provider.
    
    CRITICAL: Category MUST match - wrong category = 0 score
    
    Scoring breakdown (max 100):
    - Category Match: REQUIRED (0 if mismatch, continue if match)
    - Location Proximity: 0-40 points (closer = better)
    - Provider Rating: 0-35 points (higher rating = better)
    - Availability: 0-15 points (available = bonus)
    - Experience: 0-10 points (more jobs = bonus)
    """
    score = 0
    
    # 1. CATEGORY MATCH - MOST CRITICAL
    # If categories don't match, return 0 immediately
    if not provider.category or not request_obj.category:
        return 0
    
    if provider.category.id != request_obj.category.id:
        # Wrong category = NO MATCH AT ALL
        return 0
    
    # Category matches, continue scoring...
    
    # 2. LOCATION PROXIMITY (0-40 points)
    if request_obj.latitude and request_obj.longitude and provider.latitude and provider.longitude:
        distance = calculate_distance(
            request_obj.latitude,
            request_obj.longitude,
            provider.latitude,
            provider.longitude
        )
        
        if distance is not None:
            if distance <= 2:
                score += 40  # Very close
            elif distance <= 5:
                score += 35  # Close
            elif distance <= 10:
                score += 25  # Nearby
            elif distance <= 20:
                score += 15  # Moderate distance
            elif distance <= 50:
                score += 5   # Far but reachable
            # More than 50km = 0 points
    
    # 3. PROVIDER RATING (0-35 points)
    if provider.rating:
        rating_score = (float(provider.rating) / 5.0) * 35
        score += rating_score
    
    # 4. AVAILABILITY (0-15 points)
    if hasattr(provider, 'availability_status'):
        if provider.availability_status == 'available':
            score += 15
        elif provider.availability_status == 'busy':
            score += 5
    elif hasattr(provider, 'available') and provider.available:
        score += 15
    
    # 5. EXPERIENCE BONUS (0-10 points)
    # Providers with more completed jobs get bonus
    try:
        from .models import Job
        completed_jobs = Job.objects.filter(
            provider=provider,
            status='completed'
        ).count()
        
        if completed_jobs >= 50:
            score += 10
        elif completed_jobs >= 20:
            score += 7
        elif completed_jobs >= 10:
            score += 5
        elif completed_jobs >= 5:
            score += 3
    except:
        pass
    
    return round(score, 2)

