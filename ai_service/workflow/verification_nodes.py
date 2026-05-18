import json
import os
import base64
from langchain_core.messages import HumanMessage
from gemini_client import get_llm_pro
from .state import AgentState

MOCK_ID_RESULTS = {
    "document_type": "unknown",
    "is_authentic": True,
    "authenticity_score": 0.9,
    "name_extracted": None,
    "expiry_date_valid": True,
    "tampering_detected": False,
    "tampering_indicators": [],
    "confidence": "LOW",
}

MOCK_LIVENESS_RESULTS = {
    "face_matches_id": True,
    "liveness_score": 0.8,
    "both_clearly_visible": True,
    "reasoning": "Gemini API key not configured - mock result",
}

MOCK_CERT_RESULTS = {
    "verified": True,
    "subject": "Professional certificate",
    "issuer": "Unknown",
    "expiry_date": None,
    "is_official_document": True,
    "cert_score": 0.85,
}


def encode_image(image_path):
    if not image_path or not os.path.exists(image_path):
        return None
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def id_verification_node(state: AgentState):
    """
    Node to verify ID authenticity and extract data using Gemini 3.1 Pro preview.
    """
    llm_pro = get_llm_pro()
    if llm_pro is None:
        return {"id_results": dict(MOCK_ID_RESULTS)}

    content = []
    for path in [state.get("id_front_path"), state.get("id_back_path")]:
        encoded = encode_image(path)
        if encoded:
            content.append({
                "type": "image_url",
                "image_url": f"data:image/jpeg;base64,{encoded}"
            })

    if not content:
        return {"errors": state.get("errors", []) + ["No ID images found"]}

    prompt = """Analyze the provided government ID images. Return ONLY valid JSON.
{
  "document_type": "passport | national_id | drivers_license | unknown",
  "is_authentic": boolean,
  "authenticity_score": float 0.0-1.0,
  "name_extracted": "Full name or null",
  "expiry_date_valid": boolean,
  "tampering_detected": boolean,
  "tampering_indicators": [],
  "confidence": "HIGH | MEDIUM | LOW"
}"""

    try:
        res = llm_pro.invoke([HumanMessage(content=content), HumanMessage(content=prompt)])
        text = res.content
        if "```json" in text: text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text: text = text.split("```")[1].split("```")[0].strip()
        data = json.loads(text)
        return {"id_results": data}
    except Exception as e:
        return {"errors": state.get("errors", []) + [str(e)]}


def liveness_node(state: AgentState):
    """
    Node to compare selfie with ID and check for liveness.
    """
    llm_pro = get_llm_pro()
    if llm_pro is None:
        return {"liveness_results": dict(MOCK_LIVENESS_RESULTS)}

    images = [state.get("id_front_path"), state.get("selfie_path")]
    content = []
    for path in images:
        encoded = encode_image(path)
        if encoded:
            content.append({
                "type": "image_url",
                "image_url": f"data:image/jpeg;base64,{encoded}"
            })

    if len(content) < 2:
        return {"errors": state.get("errors", []) + ["Missing ID or Selfie for comparison"]}

    prompt = """Compare the person in the selfie image with the person in the ID document image.
Return ONLY valid JSON.
{
  "face_matches_id": boolean,
  "liveness_score": float 0.0-1.0,
  "both_clearly_visible": boolean,
  "reasoning": "Short explanation of match or mismatch"
}"""

    try:
        res = llm_pro.invoke([HumanMessage(content=content), HumanMessage(content=prompt)])
        text = res.content
        if "```json" in text: text = text.split("```json")[1].split("```")[0].strip()
        data = json.loads(text)
        return {"liveness_results": data}
    except Exception as e:
        return {"errors": state.get("errors", []) + [str(e)]}


def cert_verification_node(state: AgentState):
    """
    Node to verify professional certificates.
    """
    llm_pro = get_llm_pro()
    if llm_pro is None:
        return {"cert_results": dict(MOCK_CERT_RESULTS)}

    path = state.get("cert_path")
    encoded = encode_image(path)
    if not encoded:
        return {"cert_results": {"verified": False, "reason": "No certificate provided"}}

    prompt = """Analyze the provided professional certificate. Verify its validity and extract the subject/skill.
Return ONLY valid JSON.
{
  "verified": boolean,
  "subject": "e.g. Master Plumber License",
  "issuer": "Extracted issuer name",
  "expiry_date": "YYYY-MM-DD or null",
  "is_official_document": boolean,
  "cert_score": float 0.0-1.0
}"""

    try:
        res = llm_pro.invoke([HumanMessage(content=[{"type": "image_url", "image_url": f"data:image/jpeg;base64,{encoded}"}, {"type": "text", "text": prompt}])])
        text = res.content
        if "```json" in text: text = text.split("```json")[1].split("```")[0].strip()
        data = json.loads(text)
        return {"cert_results": data}
    except Exception as e:
        return {"errors": state.get("errors", []) + [str(e)]}


def scoring_node(state: AgentState):
    """
    Calculate the final TrustScore.
    """
    id_res = state.get("id_results", {})
    live_res = state.get("liveness_results", {})
    cert_res = state.get("cert_results", {})

    # Weighting
    id_score = id_res.get("authenticity_score", 0) * 0.4
    live_score = live_res.get("liveness_score", 0) * 0.4
    cert_score = cert_res.get("cert_score", 0) * 0.2 if cert_res.get("verified") else 0

    trust_score = round((id_score + live_score + cert_score) * 100, 2)

    return {
        "trust_score": trust_score,
        "is_complete": True
    }
