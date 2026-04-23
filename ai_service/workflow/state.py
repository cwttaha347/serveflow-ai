from typing import TypedDict, List, Optional, Dict, Any

class AgentState(TypedDict):
    # Input
    description: str
    image_paths: List[str] # Generic for request analysis
    
    # Verification Inputs
    id_front_path: str
    id_back_path: str
    selfie_path: str
    cert_path: Optional[str]
    
    # Results
    raw_ai_response: Optional[str]
    structured_data: Optional[Dict[str, Any]]
    
    # Verification Results
    id_results: Optional[Dict[str, Any]]
    liveness_results: Optional[Dict[str, Any]]
    cert_results: Optional[Dict[str, Any]]
    trust_score: float
    
    # Status/Errors
    errors: List[str]
    retry_count: int
    next_step: str
    is_complete: bool
