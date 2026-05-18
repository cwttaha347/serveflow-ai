"""Resolve Gemini credentials from SystemSettings (admin panel) for AI calls."""
from __future__ import annotations

from django.conf import settings

from .models import SystemSettings


def get_gemini_api_keys(*, sync_env_to_db: bool = False) -> list[str]:
    """DB-first keys configured in the admin settings panel."""
    return SystemSettings.get_settings().get_gemini_api_keys(
        prefer_env=False,
        sync_env_to_db=sync_env_to_db,
    )


def pick_gemini_api_key(rotation_index: int = 0) -> str | None:
    keys = get_gemini_api_keys()
    if not keys:
        return None
    return keys[rotation_index % len(keys)]


def ai_service_request_headers(rotation_index: int = 0) -> dict[str, str]:
    """Headers for outbound calls to the ai_service microservice."""
    key = pick_gemini_api_key(rotation_index)
    if not key:
        return {}
    return {"X-Gemini-Api-Key": key}


def ai_service_internal_token() -> str:
    return (getattr(settings, "AI_SERVICE_INTERNAL_TOKEN", None) or "").strip()
