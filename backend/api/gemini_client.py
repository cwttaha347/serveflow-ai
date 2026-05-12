"""Google Gen AI SDK (google-genai) helpers for Gemini model selection."""
from __future__ import annotations

import hashlib
import os
from typing import Optional

from google import genai

# Only these model IDs may be used for generateContent across this codebase.
GEMINI_ALLOWED_MODEL_IDS = (
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
)
GEMINI_DEFAULT_MODEL_ID = GEMINI_ALLOWED_MODEL_IDS[0]

# Cache resolved preference per API key (avoid pinning one model across different keys).
_MODEL_BY_KEY_FP: dict[str, str] = {}


def _key_fp(api_key: str) -> str:
    return hashlib.sha256((api_key or "").encode()).hexdigest()[:32]


def _normalize_model_id(raw: str) -> str:
    s = (raw or "").strip()
    if s.startswith("models/"):
        s = s.split("models/", 1)[1]
    return s


def _supports_generate_content(model) -> bool:
    actions = getattr(model, "supported_actions", None)
    if actions is not None:
        try:
            return "generateContent" in actions
        except TypeError:
            return "generateContent" in list(actions)
    methods = getattr(model, "supported_generation_methods", None) or []
    return "generateContent" in methods


def ordered_gemini_model_ids_for_call(_api_key: str | None = None) -> tuple[str, ...]:
    """
    Models to try for vision or multi-model flows (flash first, then pro).
    If GEMINI_MODEL_NAME is set to one of GEMINI_ALLOWED_MODEL_IDS, only that id is used.
    """
    forced = _normalize_model_id(os.environ.get("GEMINI_MODEL_NAME") or "")
    if forced and forced in GEMINI_ALLOWED_MODEL_IDS:
        return (forced,)
    return GEMINI_ALLOWED_MODEL_IDS


def resolve_gemini_model_name(api_key: str) -> str:
    """
    Pick one model id suitable for callers that only invoke generate_content once.
    Only GEMINI_ALLOWED_MODEL_IDS are permitted. GEMINI_MODEL_NAME may select one of them.
    Preference order when listing models: flash preview first, then pro preview.
    Cached per API key fingerprint (not process-global singleton).
    """
    fp = _key_fp(api_key)
    if fp in _MODEL_BY_KEY_FP:
        return _MODEL_BY_KEY_FP[fp]

    forced = _normalize_model_id(os.environ.get("GEMINI_MODEL_NAME") or "")
    if forced and forced in GEMINI_ALLOWED_MODEL_IDS:
        _MODEL_BY_KEY_FP[fp] = forced
        return forced

    try:
        client = genai.Client(api_key=api_key)
        models = list(client.models.list())
        name_set = {getattr(m, "name", "") for m in models}

        for n in GEMINI_ALLOWED_MODEL_IDS:
            full = f"models/{n}"
            if full in name_set:
                mobj = next((mm for mm in models if getattr(mm, "name", "") == full), None)
                if mobj and _supports_generate_content(mobj):
                    _MODEL_BY_KEY_FP[fp] = n
                    return n
    except Exception:
        pass

    _MODEL_BY_KEY_FP[fp] = GEMINI_DEFAULT_MODEL_ID
    return _MODEL_BY_KEY_FP[fp]
