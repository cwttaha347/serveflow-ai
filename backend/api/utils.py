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
    
    # Normalize request_obj (can be a Request model instance or a dictionary)
    if isinstance(request_obj, dict):
        req_category_id = request_obj.get('category_id') or request_obj.get('category')
        req_lat = request_obj.get('latitude')
        req_lon = request_obj.get('longitude')
    else:
        req_category_id = request_obj.category.id if request_obj.category else None
        req_lat = request_obj.latitude
        req_lon = request_obj.longitude

    # 1. CATEGORY MATCH - MOST CRITICAL
    if not req_category_id:
        return 0
    
    # Providers have 'categories' (ManyToManyField)
    if not provider.categories.filter(id=req_category_id).exists():
        return 0
    
    # Category matches, continue scoring...
    
    # 2. LOCATION PROXIMITY (0-40 points)
    # Coordinates are in the User's Profile
    prov_lat = None
    prov_lon = None
    if hasattr(provider.user, 'profile'):
        prov_lat = provider.user.profile.latitude
        prov_lon = provider.user.profile.longitude

    if req_lat and req_lon and prov_lat and prov_lon:
        distance = calculate_distance(req_lat, req_lon, prov_lat, prov_lon)
        
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

