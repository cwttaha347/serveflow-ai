"""
Shared helpers for auth endpoint hardening: throttling keys, lockouts, validation, audit logging.
"""
import hashlib
import logging
import re
from typing import Optional, Tuple

from django.conf import settings
from django.core.cache import cache
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_client_ip(request) -> str:
    forwarded = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return (request.META.get("REMOTE_ADDR") or "unknown").strip()


def normalize_email(value) -> str:
    return str(value or "").strip().lower()


def email_fingerprint(email: str) -> str:
    normalized = normalize_email(email)
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def validate_auth_email(email: str) -> Optional[str]:
    """Return error message if invalid, else None."""
    normalized = normalize_email(email)
    if not normalized or len(normalized) > 254:
        return "A valid email address is required."
    if not _EMAIL_RE.match(normalized):
        return "A valid email address is required."
    try:
        validate_email(normalized)
    except DjangoValidationError:
        return "A valid email address is required."
    return None


def reject_oversized_body(request) -> Optional[Response]:
    """Reject large POST bodies without reading request.body (DRF may have parsed it already)."""
    max_bytes = int(getattr(settings, "AUTH_MAX_BODY_BYTES", 8192))
    content_length = request.META.get("CONTENT_LENGTH")
    try:
        body_len = int(content_length) if content_length else 0
    except (TypeError, ValueError):
        body_len = 0
    if body_len > max_bytes:
        return Response(
            {"error": "Request body too large."},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )
    return None


def reject_empty_password(password) -> Optional[Response]:
    if password is None or str(password).strip() == "":
        return Response(
            {"error": "Password is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    max_len = int(getattr(settings, "AUTH_MAX_PASSWORD_LENGTH", 128))
    if len(str(password)) > max_len:
        return Response(
            {"error": "Password is too long."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


def log_auth_failure(event: str, request, *, reason: str = "", email_fp: str = "", user_id=None):
    logger.warning(
        "auth_failure event=%s ip=%s email_fp=%s user_id=%s reason=%s",
        event,
        get_client_ip(request),
        email_fp or "-",
        user_id if user_id is not None else "-",
        reason or "-",
    )


def log_auth_success(event: str, request, *, email_fp: str = "", user_id=None):
    logger.info(
        "auth_success event=%s ip=%s email_fp=%s user_id=%s",
        event,
        get_client_ip(request),
        email_fp or "-",
        user_id if user_id is not None else "-",
    )


def _failure_key(scope: str, identifier: str) -> str:
    return f"auth_fail:{scope}:{identifier}"


def _lockout_key(scope: str, identifier: str) -> str:
    return f"auth_lockout:{scope}:{identifier}"


def is_auth_locked(scope: str, identifier: str) -> bool:
    if not identifier:
        return False
    return cache.get(_lockout_key(scope, identifier)) is not None


def lockout_response() -> Response:
    minutes = max(1, int(getattr(settings, "AUTH_LOCKOUT_DURATION_SECONDS", 900)) // 60)
    return Response(
        {
            "error": (
                f"Too many failed attempts. Please try again in about {minutes} minutes."
            )
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def check_lockouts(request, scope: str, identifiers: Tuple[str, ...]) -> Optional[Response]:
    for ident in identifiers:
        if ident and is_auth_locked(scope, ident):
            return lockout_response()
    return None


def record_auth_failure(scope: str, identifier: str) -> bool:
    """Increment failure counter; return True if identifier is now locked out."""
    if not identifier:
        return False
    max_attempts = int(getattr(settings, "AUTH_LOCKOUT_MAX_ATTEMPTS", 5))
    window = int(getattr(settings, "AUTH_LOCKOUT_WINDOW_SECONDS", 900))
    duration = int(getattr(settings, "AUTH_LOCKOUT_DURATION_SECONDS", 900))

    fail_key = _failure_key(scope, identifier)
    count = int(cache.get(fail_key, 0)) + 1
    cache.set(fail_key, count, timeout=window)
    if count >= max_attempts:
        cache.set(_lockout_key(scope, identifier), True, timeout=duration)
        cache.delete(fail_key)
        return True
    return False


def clear_auth_failures(scope: str, *identifiers: str):
    for ident in identifiers:
        if not ident:
            continue
        cache.delete(_failure_key(scope, ident))
        cache.delete(_lockout_key(scope, ident))


class AuthIPThrottle(ScopedRateThrottle):
    """Scoped rate limit keyed by client IP."""

    def get_cache_key(self, request, view):
        if request.method != "POST":
            return None
        scope = getattr(view, "throttle_scope", None)
        if not scope:
            return None
        return self.cache_format % {"scope": scope, "ident": get_client_ip(request)}


class AuthEmailThrottle(ScopedRateThrottle):
    """Scoped rate limit keyed by normalized email from POST body."""

    def get_cache_key(self, request, view):
        if request.method != "POST":
            return None
        scope = getattr(view, "email_throttle_scope", None)
        if not scope:
            return None
        email = normalize_email(request.data.get("email"))
        if not email:
            return None
        return self.cache_format % {"scope": scope, "ident": email_fingerprint(email)}
