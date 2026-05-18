"""Resolve Gemini API keys: per-request header, backend DB sync, then env fallback."""
from __future__ import annotations

import os
import threading
import time
from contextvars import ContextVar

import requests

_request_key: ContextVar[str | None] = ContextVar("gemini_api_key", default=None)
_cached_keys: list[str] = []
_cache_at: float = 0.0
_lock = threading.Lock()
_CACHE_TTL_SECONDS = 60


def set_request_gemini_api_key(key: str | None) -> None:
    k = (key or "").strip() or None
    _request_key.set(k)


def clear_request_gemini_api_key() -> None:
    _request_key.set(None)


def refresh_keys_from_backend(*, force: bool = False) -> None:
    global _cached_keys, _cache_at
    if not force and _cached_keys and (time.time() - _cache_at) < _CACHE_TTL_SECONDS:
        return

    base = (os.environ.get("BACKEND_INTERNAL_URL") or "http://backend:8000").rstrip("/")
    token = (os.environ.get("AI_SERVICE_INTERNAL_TOKEN") or "").strip()
    if not token:
        return

    try:
        response = requests.get(
            f"{base}/api/settings/internal_ai_credentials/",
            headers={"X-Internal-Token": token},
            timeout=5,
        )
        response.raise_for_status()
        payload = response.json()
        keys = [str(k).strip() for k in (payload.get("gemini_api_keys") or []) if str(k).strip()]
        with _lock:
            _cached_keys = keys
            _cache_at = time.time()
    except Exception:
        pass


def get_gemini_api_keys() -> list[str]:
    req_key = _request_key.get()
    if req_key:
        return [req_key]

    refresh_keys_from_backend()
    with _lock:
        if _cached_keys:
            return list(_cached_keys)

    env_key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    return [env_key] if env_key else []


def get_gemini_api_key() -> str | None:
    keys = get_gemini_api_keys()
    return keys[0] if keys else None


def gemini_keys_configured() -> bool:
    return bool(get_gemini_api_key())
