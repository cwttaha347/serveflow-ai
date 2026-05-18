import ipaddress
import os

from django.conf import settings


def _is_private_or_local_host(hostname: str) -> bool:
    hostname = (hostname or "").strip().lower()
    if not hostname:
        return False
    if hostname in ("localhost", "backend", "host.docker.internal"):
        return True
    if hostname.endswith(".local"):
        return True
    try:
        ip = ipaddress.ip_address(hostname)
        return ip.is_private or ip.is_loopback
    except ValueError:
        return False


class AllowLanHostMiddleware:
    """
    Local dev / Docker: accept LAN and private-network Host headers.
    Prevents opaque Django HTML 400 (DisallowedHost) when not using localhost.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self._enabled = settings.DEBUG or os.environ.get("ALLOW_LAN_HOSTS", "True").lower() == "true"

    def __call__(self, request):
        if self._enabled:
            host = request.META.get("HTTP_HOST", "").split(":")[0].strip().lower()
            if host and host not in settings.ALLOWED_HOSTS and _is_private_or_local_host(host):
                settings.ALLOWED_HOSTS.append(host)
        return self.get_response(request)


class SecurityHeadersMiddleware:
    """Add security headers to all responses"""
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Prevent clickjacking
        response['X-Frame-Options'] = 'DENY'
        
        # Prevent MIME type sniffing
        response['X-Content-Type-Options'] = 'nosniff'
        
        # Enable XSS protection
        response['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer policy
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "img-src 'self' data: blob: https://images.unsplash.com https://*.stripe.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com; "
            "connect-src 'self' https://serveflow-backend.koyeb.app wss://serveflow-backend.koyeb.app https://api.stripe.com;"
        )
        response['Content-Security-Policy'] = csp
        
        return response

class DisableCSRFForAPIMiddleware:
    """Completely bypass CSRF for API endpoints (Token Auth only)"""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            request._dont_enforce_csrf_checks = True
        return self.get_response(request)
