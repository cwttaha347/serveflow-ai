from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from PIL import Image
import io
import os

# Initialize FastAPI
app = FastAPI(title="AI Service for ServeFlow")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Models
class RequestAnalysisInput(BaseModel):
    title: str
    description: str
    category: str

class DisputeInput(BaseModel):
    reason: str
    job_context: dict

@app.get("/")
async def root():
    return {"service": "AI Service", "status": "running", "port": 8001}

@app.post("/ai/analyze-request")
async def analyze_request(input_data: RequestAnalysisInput):
    """
    Analyze a service request using Gemini LLM
    Returns: structured summary, urgency level, estimated complexity
    """
    if not GEMINI_API_KEY:
        return {
            "summary": f"Service request for {input_data.category}",
            "urgency": "medium",
            "complexity": "standard",
            "key_points": [input_data.title],
            "estimated_duration": "2-4 hours",
            "warning": "Gemini API key not configured - using mock data"
        }
    
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""
        Analyze this service request and provide a structured analysis:
        
        Title: {input_data.title}
        Description: {input_data.description}
        Category: {input_data.category}
        
        Provide:
        1. A brief summary (1-2 sentences)
        2. Urgency level (low/medium/high)
        3. Complexity assessment (simple/standard/complex)
        4. Key points (3-5 bullet points)
        5. Estimated duration
        
        Format as JSON with keys: summary, urgency, complexity, key_points, estimated_duration
        """
        
        response = model.generate_content(prompt)
        
        # Parse response (simplified - in production use structured output)
        return {
            "summary": f"Analyzed request for {input_data.category}",
            "urgency": "medium",
            "complexity": "standard",
            "key_points": [input_data.title, input_data.description[:100]],
            "estimated_duration": "2-4 hours",
            "ai_response": response.text
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

@app.post("/ai/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyze uploaded image using Gemini Vision
    Returns: description, detected objects, suggested actions
    """
    if not GEMINI_API_KEY:
        return {
            "description": "Image uploaded successfully",
            "detected_objects": ["general object"],
            "suggested_actions": ["Review manually"],
            "confidence": 0.5,
            "warning": "Gemini API key not configured - using mock data"
        }
    
    try:
        # Read image
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        # Use Gemini Vision
        model = genai.GenerativeModel('gemini-pro-vision')
        
        prompt = """
        Analyze this image in the context of a service request.
        Describe what you see, identify any issues or problems visible,
        and suggest what type of service might be needed.
        """
        
        response = model.generate_content([prompt, image])
        
        return {
            "description": response.text,
            "detected_objects": ["analyzed via Gemini Vision"],
            "suggested_actions": ["Check AI description"],
            "confidence": 0.9
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")

@app.post("/ai/summarize-dispute")
async def summarize_dispute(input_data: DisputeInput):
    """
    Summarize a dispute using Gemini LLM
    Returns: summary, severity, recommended_action
    """
    if not GEMINI_API_KEY:
        return {
            "summary": "Dispute requires review",
            "severity": "medium",
            "recommended_action": "Manual review required",
            "key_issues": [input_data.reason[:100]],
            "warning": "Gemini API key not configured - using mock data"
        }
    
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""
        Analyze this service dispute and provide recommendations:
        
        Reason: {input_data.reason}
        Job Context: {input_data.job_context}
        
        Provide:
        1. A brief summary
        2. Severity assessment (low/medium/high)
        3. Recommended action for admin
        4. Key issues identified
        
        Format as JSON with keys: summary, severity, recommended_action, key_issues
        """
        
        response = model.generate_content(prompt)
        
        return {
            "summary": f"Dispute analysis completed",
            "severity": "medium",
            "recommended_action": "Review case details",
            "key_issues": [input_data.reason],
            "ai_analysis": response.text
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dispute analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
