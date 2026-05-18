"""Brand assets and email/PDF branding helpers."""
from pathlib import Path

from django.conf import settings

LOGO_FILENAME = "serveflow-logo.png"
LOGO_PATH = Path(__file__).resolve().parent / "branding" / LOGO_FILENAME


def logo_url():
    """Public URL for the logo (served from frontend public/ in production)."""
    front = str(getattr(settings, "FRONTEND_URL", "") or "").strip().rstrip("/")
    if front:
        return f"{front}/{LOGO_FILENAME}"
    return ""


def email_branding_context(extra=None):
    """Shared template context for HTML emails."""
    from .models import SystemSettings

    sys = SystemSettings.get_settings()
    ctx = {
        "platform_name": (sys.platform_name or "ServeFlow AI").strip(),
        "logo_url": logo_url(),
    }
    if extra:
        ctx.update(extra)
    return ctx
