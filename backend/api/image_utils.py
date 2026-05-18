"""Server-side image optimization for user uploads (Pillow)."""
import io
import os

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

MAX_DIMENSION = 1920
JPEG_QUALITY = 85
MAX_BYTES = 10 * 1024 * 1024


def optimize_image_field(image_field, *, max_dim=MAX_DIMENSION, quality=JPEG_QUALITY, max_bytes=MAX_BYTES):
    """
    Downscale and re-encode an ImageFieldFile in place when it exceeds target size or dimensions.
    Returns True if the file was rewritten.
    """
    if not image_field or not getattr(image_field, 'name', None):
        return False

    try:
        image_field.open('rb')
        raw = image_field.read()
    finally:
        image_field.close()

    if not raw:
        return False

    needs_resize = False
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if max(probe.size) > max_dim:
                needs_resize = True
    except Exception:
        return False

    if len(raw) <= max_bytes and not needs_resize:
        return False

    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
        if max(img.size) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=quality, optimize=True, progressive=True)
        out = buf.getvalue()
        if len(out) >= len(raw) and max(img.size) <= max_dim:
            return False

        stem = os.path.splitext(os.path.basename(image_field.name))[0] or 'image'
        image_field.save(f'{stem}.jpg', ContentFile(out), save=False)
        return True
    except Exception:
        return False
