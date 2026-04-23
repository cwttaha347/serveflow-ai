from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import math

app = FastAPI(title="Provider Matching Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Provider(BaseModel):
    provider_id: int
    latitude: float
    longitude: float
    rating: float
    completed_jobs: int
    availability_status: str
    categories: List[str]

class MatchRequest(BaseModel):
    request_id: int
    category: str
    latitude: float
    longitude: float
    urgency: str = "medium"
    providers: List[Provider]

class MatchResult(BaseModel):
    provider_id: int
    match_score: float
    distance: float
    rating: float
    availability: str
    reason: str

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in kilometers using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat/2) * math.sin(dlat/2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon/2) * math.sin(dlon/2))
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return round(distance, 2)

def calculate_match_score(provider: Provider, request: MatchRequest, distance: float) -> float:
    """
    Calculate match score based on:
    - Distance (40%)
    - Rating (30%)
    - Experience (20%)
    - Availability (10%)
    """
    # Distance score (closer is better, max 50km)
    distance_score = max(0, 1 - (distance / 50)) * 0.4
    
    # Rating score (0-5 scale)
    rating_score = (provider.rating / 5) * 0.3
    
    # Experience score
    experience_score = min(1, provider.completed_jobs / 100) * 0.2
    
    # Availability score
    availability_score = 0.1 if provider.availability_status == "available" else 0
    
    # Urgency bonus
    urgency_bonus = 0.1 if request.urgency == "high" and distance < 10 else 0
    
    total_score = (distance_score + rating_score + experience_score + 
                   availability_score + urgency_bonus)
    
    return round(min(1.0, total_score), 3)

@app.get("/")
async def root():
    return {"service": "Provider Matching Service", "status": "running", "port": 8002}

@app.post("/match/providers", response_model=List[MatchResult])
async def match_providers(request: MatchRequest):
    """
    Match providers to a service request
    Returns ranked list of providers with match scores
    """
    if not request.providers:
        raise HTTPException(status_code=400, detail="No providers available")
    
    matches = []
    
    for provider in request.providers:
        # Check category match
        if request.category not in provider.categories:
            continue
        
        # Calculate distance
        distance = calculate_distance(
            request.latitude, request.longitude,
            provider.latitude, provider.longitude
        )
        
        # Skip if too far (> 100km)
        if distance > 100:
            continue
        
        # Calculate match score
        score = calculate_match_score(provider, request, distance)
        
        # Determine reason
        if score > 0.8:
            reason = "Excellent match: High rating, nearby, available"
        elif score > 0.6:
            reason = "Good match: Experienced provider in your area"
        elif score > 0.4:
            reason = "Acceptable match: Available for your service"
        else:
            reason = "Available provider"
        
        matches.append(MatchResult(
            provider_id=provider.provider_id,
            match_score=score,
            distance=distance,
            rating=provider.rating,
            availability=provider.availability_status,
            reason=reason
        ))
    
    # Sort by match score (descending)
    matches.sort(key=lambda x: x.match_score, reverse=True)
    
    # Return top 10 matches
    return matches[:10]

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "matching"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
