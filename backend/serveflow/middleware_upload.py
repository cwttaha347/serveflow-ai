from django.conf import settings
from django.core.exceptions import RequestDataTooBig
from django.http import JsonResponse


class UploadTooLargeMiddleware:
    """Return JSON 413 when Django rejects an oversized request body."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except RequestDataTooBig:
            max_mb = int(getattr(settings, 'UPLOAD_MAX_BYTES', 10 * 1024 * 1024) / (1024 * 1024))
            return JsonResponse(
                {
                    'error': f'Upload exceeds the {max_mb}MB limit.',
                    'code': 'FILE_TOO_LARGE',
                },
                status=413,
            )
