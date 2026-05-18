from django.conf import settings as django_settings
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SystemSettings
from .serializers_settings import SystemSettingsSerializer
from .ai_credentials import ai_service_internal_token, get_gemini_api_keys

from .permissions import IsAdminRole

class SystemSettingsViewSet(viewsets.GenericViewSet):
    # Only Admin can manage settings
    permission_classes = [IsAdminRole]
    serializer_class = SystemSettingsSerializer

    def get_queryset(self):
        return SystemSettings.objects.all()

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def public_config(self, request):
        settings = SystemSettings.get_settings()
        return Response({
            'platform_name': settings.platform_name,
            'contact_email': settings.contact_email,
            'currency_symbol': settings.currency_symbol,
            'maintenance_mode': settings.maintenance_mode,
            'stripe_public_key': settings.stripe_public_key,
            'stripe_mode': settings.stripe_mode,
        })
    

    @action(detail=False, methods=['get', 'post'])
    def config(self, request):
        settings = SystemSettings.get_settings()
        
        if request.method == 'GET':
            serializer = self.get_serializer(settings)
            return Response(serializer.data)
        
        serializer = self.get_serializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["get"],
        url_path="internal-ai-credentials",
        permission_classes=[permissions.AllowAny],
        authentication_classes=[],
    )
    def internal_ai_credentials(self, request):
        """Service-to-service: ai_service reads Gemini keys stored in admin settings."""
        token = (request.headers.get("X-Internal-Token") or "").strip()
        expected = ai_service_internal_token()
        if not expected or token != expected:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        keys = get_gemini_api_keys()
        return Response({
            "gemini_api_keys": keys,
            "has_key": bool(keys),
            "enable_ai_analysis": bool(SystemSettings.get_settings().enable_ai_analysis),
        })
