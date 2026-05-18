"""
Parse credentials.txt and map values to SystemSettings field names.
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_BRACKET = re.compile(r"\[([^\]]+)\]")
_API_KEY = re.compile(r"API_KEY_(\d)\s*=\s*(\S+)", re.IGNORECASE)


def resolve_credentials_path() -> Path | None:
    """Resolve credentials file: CREDENTIALS_FILE env, then repo root."""
    env_path = (os.environ.get("CREDENTIALS_FILE") or "").strip()
    if env_path:
        p = Path(env_path)
        if p.is_file():
            return p
        logger.warning("CREDENTIALS_FILE set but not found: %s", env_path)

    candidates = [
        Path("/app/credentials.txt"),
        Path(__file__).resolve().parent.parent.parent / "credentials.txt",
    ]
    for p in candidates:
        if p.is_file():
            return p
    return None


def _first_bracket_after(text: str, *markers: str) -> str:
    """Return first bracketed value after any marker line (case-insensitive)."""
    lower = text.lower()
    for marker in markers:
        idx = lower.find(marker.lower())
        if idx == -1:
            continue
        chunk = text[idx : idx + 500]
        m = _BRACKET.search(chunk)
        if m:
            return m.group(1).strip()
    return ""


def parse_credentials_file(path: Path) -> dict[str, str | int | bool]:
    """Parse credentials.txt into SystemSettings-compatible keys."""
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        logger.warning("Could not read credentials file %s: %s", path, exc)
        return {}

    data: dict[str, str | int | bool] = {}

    pk = _first_bracket_after(raw, "stripe publishable", "publishable")
    sk = _first_bracket_after(raw, "stripe secret", "secret")
    if pk:
        data["stripe_public_key"] = pk
    if sk:
        data["stripe_secret_key"] = sk
    if pk.startswith("pk_live") or sk.startswith("sk_live"):
        data["stripe_mode"] = "live"
    elif pk or sk:
        data["stripe_mode"] = "test"

    smtp_host = _first_bracket_after(raw, "smtp host")
    smtp_user = _first_bracket_after(raw, "username")
    smtp_pass = _first_bracket_after(raw, "password")
    if smtp_host:
        data["smtp_host"] = smtp_host
    if smtp_user:
        data["smtp_user"] = smtp_user
    if smtp_pass:
        data["smtp_password"] = smtp_pass

    from_email = _first_bracket_after(
        raw,
        "from email",
        "default from",
        "default_from_email",
        "sender",
        "from address",
    )
    if from_email:
        data["from_email"] = from_email
    elif smtp_user:
        data["from_email"] = f"ServeFlow AI <{smtp_user}>"

    port_m = re.search(r"port\s*=\s*(\d+)", raw, re.IGNORECASE)
    if port_m:
        data["smtp_port"] = int(port_m.group(1))
    data.setdefault("smtp_use_tls", True)

    for num, key in _API_KEY.findall(raw):
        idx = int(num)
        if 1 <= idx <= 5 and key.strip():
            data[f"gemini_api_key_{idx}"] = key.strip()

    return data


def apply_credentials_to_settings(settings_row, parsed: dict, *, fill_empty_only: bool = True) -> list[str]:
    """
    Apply parsed credentials to a SystemSettings instance.
    Returns list of field names updated.
    """
    if not parsed:
        return []

    updated: list[str] = []
    for field, value in parsed.items():
        if not hasattr(settings_row, field):
            continue
        current = getattr(settings_row, field)
        if fill_empty_only:
            if isinstance(current, bool):
                continue
            if isinstance(current, int):
                if current not in (None, 0) and field == "smtp_port" and current != 587:
                    # Keep non-default port if already set
                    if current:
                        continue
            elif (str(current or "").strip()):
                continue
        setattr(settings_row, field, value)
        updated.append(field)
    return updated
