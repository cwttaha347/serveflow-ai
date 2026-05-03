import os
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token
from channels.db import database_sync_to_async
from urllib.parse import parse_qs


def build_websocket_allowed_origin_patterns():
    """
    Origins for channels.security.websocket.OriginValidator.

    Hugging Face Spaces use https://<space>.hf.space; ALLOWED_HOSTS entries are
    often hostnames only, which does not match those full origins. We always
    allow https://*.hf.space (and http for local tunnels). DEBUG also enables *.
    """
    patterns = []
    if getattr(settings, "DEBUG", False):
        patterns.append("*")
    for h in getattr(settings, "ALLOWED_HOSTS", []):
        h = str(h).strip()
        if h == "*":
            patterns.append("*")
        elif h:
            patterns.append(f"https://{h}")
            patterns.append(f"http://{h}")
    extra = os.environ.get("WS_EXTRA_ALLOWED_ORIGINS", "")
    if extra.strip():
        for part in extra.split(","):
            p = part.strip()
            if p:
                patterns.append(p)
    patterns.extend(["https://.hf.space", "http://.hf.space"])
    seen = set()
    out = []
    for p in patterns:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out or ["*"]


@database_sync_to_async
def get_user(token_key):
    try:
        token = Token.objects.get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()

class TokenAuthMiddleware:
    """
    Custom middleware to authenticate users via Token in query string.
    Usage: ws://host/path?token=xxxx
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token_key = query_params.get('token', [None])[0]

        if token_key:
            scope['user'] = await get_user(token_key)
        else:
            scope['user'] = AnonymousUser()
        
        return await self.inner(scope, receive, send)
