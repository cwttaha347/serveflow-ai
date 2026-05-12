from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from PIL import Image
import io
import os
from workflow.verification_graph import verification_workflow
import tempfile
from gemini_client import resolve_gemini_model_name

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

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Models
class RequestAnalysisInput(BaseModel):
    title: str
    description: str
    category: str

class DisputeInput(BaseModel):
    reason: str
    job_context: dict

class AutocompleteInput(BaseModel):
    user_input: str
    context: dict = {}

class ProviderSkillSuggestionInput(BaseModel):
    categories: list[str]

class ChatbotIntentInput(BaseModel):
    message: str
    context: dict = {}


@app.get("/")
async def root():
    return {"service": "AI Service", "status": "running", "port": 8001}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai"}

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
        client = genai.Client(api_key=GEMINI_API_KEY)
        model_name = resolve_gemini_model_name(GEMINI_API_KEY)
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
        response = client.models.generate_content(model=model_name, contents=prompt)
        
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
        
        client = genai.Client(api_key=GEMINI_API_KEY)
        model_name = resolve_gemini_model_name(GEMINI_API_KEY)
        prompt = """
        Analyze this image in the context of a service request.
        Describe what you see, identify any issues or problems visible,
        and suggest what type of service might be needed.
        """
        response = client.models.generate_content(
            model=model_name,
            contents=[prompt, image],
        )
        
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
        client = genai.Client(api_key=GEMINI_API_KEY)
        model_name = resolve_gemini_model_name(GEMINI_API_KEY)
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
        response = client.models.generate_content(model=model_name, contents=prompt)
        
        return {
            "summary": f"Dispute analysis completed",
            "severity": "medium",
            "recommended_action": "Review case details",
            "key_issues": [input_data.reason],
            "ai_analysis": response.text
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dispute analysis failed: {str(e)}")

@app.post("/ai/skill-complete")
async def autocomplete_skill(input_data: AutocompleteInput):
    """
    Real-time professional expansion of provider descriptions using Gemini 1.5 Flash.
    """
    if not GEMINI_API_KEY:
        return {
            "inline_completion": " with professional expertise and quality assurance.",
            "full_description": f"I provide professional {input_data.user_input} services with a focus on reliability and customer satisfaction.",
            "suggested_tags": ["professional", "reliable"],
            "suggested_title": f"Expert {input_data.user_input}",
            "experience_level_hint": "Expert",
            "warning": "Gemini API key not configured"
        }

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        model_name = resolve_gemini_model_name(GEMINI_API_KEY)
        prompt = f"""You are ServeFlow's professional profile writer for skilled tradespeople.
A provider has typed the following partial skill description:
"{input_data.user_input}"
Complete and expand this into a professional service listing entry.
Return ONLY valid JSON. No markdown. No explanations.
{{
  "inline_completion": "Continuation of exactly what the user typed (max 12 words). Seamlessly continues their sentence as if they typed it.",
  "full_description": "A complete 2-3 sentence professional service description suitable for a client-facing profile. Mention key skills, experience context, and what problems this service solves.",
  "suggested_tags": ["tag1", "tag2", "tag3"],
  "suggested_title": "Professional 4-6 word job title for this skill",
  "experience_level_hint": "Entry | Intermediate | Expert"
}}"""
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        text = response.text
        
        # Basic JSON cleanup
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
            
        import json
        return json.loads(text)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Autocomplete failed: {str(e)}")

@app.post("/ai/provider-skill-suggestions")
async def provider_skill_suggestions(input_data: ProviderSkillSuggestionInput):
    categories = [c.strip() for c in input_data.categories if c and c.strip()]
    if not categories:
        raise HTTPException(status_code=400, detail="At least one category is required")

    if not GEMINI_API_KEY:
        fallback_map = {
            "Plumbing": ["Leak Detection", "Pipe Repair", "Drain Cleaning", "Fixture Installation"],
            "Electrical": ["Wiring", "Circuit Troubleshooting", "Panel Upgrade", "Safety Inspection"],
            "Cleaning": ["Deep Cleaning", "Sanitization", "Move-in Cleanup", "Post-renovation Cleaning"],
            "HVAC": ["AC Service", "Duct Cleaning", "Thermostat Setup", "Cooling Diagnostics"],
            "Painting": ["Interior Painting", "Surface Preparation", "Texture Repair", "Protective Coating"],
            "Carpentry": ["Wood Repair", "Cabinet Work", "Door Installation", "Custom Shelving"],
        }
        skills = []
        for category in categories:
            skills.extend(fallback_map.get(category, [f"{category} Service", f"{category} Troubleshooting"]))
        deduped = list(dict.fromkeys(skills))
        return {"categories": categories, "skills": deduped[:20], "source": "fallback"}

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        model_name = resolve_gemini_model_name(GEMINI_API_KEY)
        prompt = f"""You generate practical skill tags for service providers.
Given categories: {", ".join(categories)}
Return ONLY valid JSON:
{{
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6"]
}}
Rules:
- Skills must be concrete and job-relevant.
- No duplicates.
- No generic words like "professional" alone.
- Keep each skill 2-4 words max."""
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        import json
        parsed = json.loads(text)
        skills = [str(s).strip() for s in parsed.get("skills", []) if str(s).strip()]
        skills = list(dict.fromkeys(skills))
        return {"categories": categories, "skills": skills[:20], "source": "gemini"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Provider skill generation failed: {str(e)}")

@app.post("/ai/chatbot-intent")
async def chatbot_intent(input_data: ChatbotIntentInput):
    text = (input_data.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="message is required")
    context = input_data.context or {}
    available_categories = context.get("available_categories") or []

    if not GEMINI_API_KEY:
        category_options = []
        for c in available_categories[:6]:
            cid = str(c.get("id", "")).strip()
            name = str(c.get("name", "")).strip()
            if cid and name:
                category_options.append({"label": name, "value": cid, "action": "choose_category"})
        return {
            "summary": text[:200],
            "intent": "clarify",
            "suggested_category": "",
            "urgency": "medium",
            "preferred_mode": "auto",
            "preferred_date_iso": "",
            "suggested_provider_id": None,
            "needs_confirmation": True,
            "suggested_title": "Service Request",
            "assistant_reply": "I captured your issue. Select the most relevant category so I can prepare an accurate draft.",
            "quick_options": category_options,
            "source": "fallback",
        }

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        model_name = resolve_gemini_model_name(GEMINI_API_KEY)
        prompt = f"""You are ServeFlow's autonomous request chatbot engine.
Analyze the latest user message and return ONLY valid JSON:
{{
  "summary": "short summary",
  "intent": "create_service_request | ask_question | clarify",
  "suggested_category": "category name from available_categories when possible",
  "urgency": "low | medium | high",
  "preferred_mode": "manual | auto | broadcast",
  "preferred_date_iso": "optional ISO datetime if user gave a date/time",
  "suggested_provider_id": "optional provider id only if explicitly available in context",
  "needs_confirmation": true,
  "suggested_title": "short action title",
  "suggested_description": "2-4 clear sentences for providers; must describe the SAME trade as suggested_category",
  "assistant_reply": "professional concise next-step response",
  "quick_options": [
    {{"label": "short CTA", "value": "raw value", "action": "set_mode | set_urgency | set_preferred_date | set_selected_provider | prepare_draft | choose_category"}}
  ]
}}
User message: "{text}"
Context: {context}
Rules:
- Use available_categories from Context when suggesting category options.
- Do not repeat the same question if context already contains that slot.
- Keep options contextual and minimal (2-5).
- If enough info is present to proceed, include a "prepare_draft" option.
- Never classify obvious plumbing (sink, faucet, drain, leak, toilet, pipe) as Electrical, or vice versa.
- suggested_description must not invent a different trade than the user described.
"""
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        output = response.text
        if "```json" in output:
            output = output.split("```json")[1].split("```")[0].strip()
        elif "```" in output:
            output = output.split("```")[1].split("```")[0].strip()
        import json
        parsed = json.loads(output)
        parsed["suggested_category"] = parsed.get("suggested_category") or ""
        parsed["suggested_title"] = parsed.get("suggested_title") or "Service Request"
        parsed["suggested_description"] = (parsed.get("suggested_description") or parsed.get("summary") or text[:500]).strip()
        parsed["preferred_date_iso"] = str(parsed.get("preferred_date_iso") or "").strip()
        try:
            parsed["suggested_provider_id"] = int(parsed.get("suggested_provider_id")) if parsed.get("suggested_provider_id") not in (None, "") else None
        except (TypeError, ValueError):
            parsed["suggested_provider_id"] = None
        parsed["needs_confirmation"] = bool(parsed.get("needs_confirmation", True))
        if not isinstance(parsed.get("quick_options"), list):
            parsed["quick_options"] = [
                {"label": "Prepare draft", "value": "prepare_draft", "action": "prepare_draft"},
                {"label": "Auto mode", "value": "auto", "action": "set_mode"},
                {"label": "Broadcast mode", "value": "broadcast", "action": "set_mode"},
            ]
        parsed["source"] = "gemini"
        return parsed
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot intent analysis failed: {str(e)}")

@app.post("/ai/verify-provider")
async def verify_provider_bundle(
    id_front: UploadFile = File(...),
    id_back: UploadFile = File(None),
    selfie: UploadFile = File(...),
    certificate: UploadFile = File(None)
):
    """
    Zero-admin verification orchestration via LangGraph.
    """
    if not GEMINI_API_KEY:
        return {
            "trust_score": 85.0,
            "id_results": {"authenticity_score": 0.9, "is_authentic": True},
            "liveness_results": {"liveness_score": 0.8, "face_matches_id": True},
            "message": "Key missing - mock result"
        }

    # Save to temp files for LangGraph to read (multimodal processing)
    temp_dir = tempfile.mkdtemp()
    
    async def save_temp(file: UploadFile, name: str):
        if not file: return None
        path = os.path.join(temp_dir, name)
        with open(path, "wb") as f:
            f.write(await file.read())
        return path

    paths = {
        "id_front_path": await save_temp(id_front, "id_front.jpg"),
        "id_back_path": await save_temp(id_back, "id_back.jpg"),
        "selfie_path": await save_temp(selfie, "selfie.jpg"),
        "cert_path": await save_temp(certificate, "cert.jpg"),
    }

    try:
        # Run LangGraph
        initial_state = {
            **paths,
            "errors": [],
            "retry_count": 0,
            "next_step": "verify_id",
            "is_complete": False
        }
        
        # Note: In a production app, we would use async invoke
        # For simplicity in this demo, we use the graph's invoke
        result = verification_workflow.invoke(initial_state)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup could be done here or via a cleanup node
        pass

@app.post("/ai/analyze-request-full")
async def analyze_request_full(
    description: str = Form(...),
    # Assuming images are passed as file_0, file_1, etc.
    # We'll use a flexible approach
):
    """
    Cognitive Analysis of a service request.
    Pillar A Ingestion point.
    """
    if not GEMINI_API_KEY:
        return {
            "title": "Emergency Leak Repair",
            "category": "Plumbing",
            "urgency_flag": True,
            "complexity": "MEDIUM",
            "estimated_duration_hours": 2.5,
            "severity_score": 7,
            "warning": "Key missing - mock result"
        }

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        model_name = resolve_gemini_model_name(GEMINI_API_KEY)
        prompt = f"""You are ServeFlow's Chief Dispatcher. 
Analyze the following customer problem description and provide a technical dispatch report.
Description: "{description}"

Return ONLY valid JSON.
{{
  "category": "Plumbing | Electrical | Cleaning | Painting | Carpentry | HVAC",
  "urgency_flag": boolean (true if damage is active or safety risk),
  "complexity": "SIMPLE | MEDIUM | COMPLEX",
  "title": "Action-oriented 3-5 word title",
  "estimated_duration_hours": float,
  "severity_score": int 1-10 (1 is minor cosmetic, 10 is catastrophic)
}}"""
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        text = response.text
        if "```json" in text: text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text: text = text.split("```")[1].split("```")[0].strip()
        
        import json
        return json.loads(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
