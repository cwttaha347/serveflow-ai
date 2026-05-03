"""Google Gen AI SDK (google-genai) helpers for Gemini model selection."""
from __future__ import annotations

import os
from typing import Optional

from google import genai

_CACHED_MODEL_NAME: Optional[str] = None


def _supports_generate_content(model) -> bool:
    actions = getattr(model, "supported_actions", None)
    if actions is not None:
        try:
            return "generateContent" in actions
        except TypeError:
            return "generateContent" in list(actions)
    methods = getattr(model, "supported_generation_methods", None) or []
    return "generateContent" in methods


def resolve_gemini_model_name(api_key: str) -> str:
    global _CACHED_MODEL_NAME

    forced = (os.environ.get("GEMINI_MODEL_NAME") or "").strip()
    if forced:
        _CACHED_MODEL_NAME = forced
        return forced

    if _CACHED_MODEL_NAME:
        return _CACHED_MODEL_NAME

    preferred = [
        "gemini-3.0-flash",
        "gemini-3-flash",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
    ]
    try:
        client = genai.Client(api_key=api_key)
        models = list(client.models.list())
        name_set = {getattr(m, "name", "") for m in models}

        for n in preferred:
            full = f"models/{n}"
            if full in name_set:
                mobj = next((mm for mm in models if getattr(mm, "name", "") == full), None)
                if mobj and _supports_generate_content(mobj):
                    _CACHED_MODEL_NAME = n
                    return n

        for m in models:
            if _supports_generate_content(m):
                raw = getattr(m, "name", "") or ""
                if raw.startswith("models/"):
                    _CACHED_MODEL_NAME = raw.split("models/", 1)[1]
                    return _CACHED_MODEL_NAME
    except Exception:
        pass

    _CACHED_MODEL_NAME = "gemini-2.0-flash"
    return _CACHED_MODEL_NAME
