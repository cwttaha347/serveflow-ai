import json
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from .state import AgentState
from PIL import Image
import base64
import io

# Initialize LLM (allowed models: gemini-3-flash-preview, gemini-3.1-pro-preview)
llm_pro = ChatGoogleGenerativeAI(model="gemini-3.1-pro-preview", google_api_key=os.getenv("GEMINI_API_KEY"))
llm_flash = ChatGoogleGenerativeAI(model="gemini-3-flash-preview", google_api_key=os.getenv("GEMINI_API_KEY"))

def analyze_request_node(state: AgentState):
    """
    Node to analyze the customer request using Gemini 3.1 Pro preview.
    """
    description = state.get("description", "")
    image_paths = state.get("image_paths", [])
    
    # Prepare content
    content = [{"type": "text", "text": description}]
    
    for img_path in image_paths:
        if os.path.exists(img_path):
            with open(img_path, "rb") as f:
                img_data = base64.b64encode(f.read()).decode("utf-8")
                content.append({
                    "type": "image_url",
                    "image_url": f"data:image/jpeg;base64,{img_data}"
                })

    # System instruction (from directive)
    system_prompt = """You are ServeFlow's job analysis engine. Analyze the user's service request
(text + optional images) and return ONLY a single valid JSON object.
Do NOT include markdown, code fences, or any explanation.
Required JSON schema:
{
  "title": "Short professional job title (max 10 words)",
  "category": "Top-level service category (e.g. Plumbing, Electrical, Carpentry)",
  "subcategory": "Specific sub-type (e.g. Pipe Repair, Circuit Breaker)",
  "severity_score": integer 1-10 (1=cosmetic, 10=emergency/safety hazard),
  "complexity": "LOW | MEDIUM | HIGH",
  "urgency_flag": boolean (true if health/safety risk or flooding/fire risk),
  "estimated_duration_hours": float (realistic time to complete),
  "required_skills": ["skill1", "skill2"],
  "summary_for_provider": "2-3 sentence technical briefing for the provider.",
  "visual_damage_assessment": "null if no image, else describe damage visible in image.",
  "materials_likely_needed": ["item1", "item2"] or []
}"""

    try:
        message = HumanMessage(content=content)
        # We can't easily pass a system prompt to ChatGoogleGenerativeAI easily in all versions 
        # but we can prepended it
        full_prompt = f"{system_prompt}\n\nUser Request: {description}"
        res = llm_pro.invoke([HumanMessage(content=content), HumanMessage(content=system_prompt)])
        
        raw_text = res.content
        # Clean up any markdown code blocks if AI ignored "No markdown" instruction
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
        structured = json.loads(raw_text)
        
        return {
            "raw_ai_response": raw_text,
            "structured_data": structured,
            "next_step": "complete" if structured else "retry",
            "is_complete": True if structured else False
        }
    except Exception as e:
        return {
            "errors": state.get("errors", []) + [str(e)],
            "next_step": "retry",
            "retry_count": state.get("retry_count", 0) + 1
        }

def finalize_node(state: AgentState):
    return {"is_complete": True}
