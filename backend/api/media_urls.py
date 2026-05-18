"""Build same-origin relative media URLs for API responses."""
import os

from django.conf import settings


def build_media_path(file_field):
    """
    Return a browser-ready path like /media/profiles/foo.jpg?v=1734567890.
    Uses file mtime for cache-busting after uploads.
    """
    if not file_field or not getattr(file_field, 'name', None):
        return None

    name = str(file_field.name).replace('\\', '/').lstrip('/')
    if name.startswith('media/'):
        name = name[6:]

    path = f"{settings.MEDIA_URL.rstrip('/')}/{name}"

    try:
        mtime = int(os.path.getmtime(file_field.path))
        return f"{path}?v={mtime}"
    except (OSError, TypeError, ValueError):
        return path
