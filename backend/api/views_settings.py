from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SystemSettings
from .serializers_settings import SystemSettingsSerializer

class SystemSettingsViewSet(viewsets.GenericViewSet):
    # Only Admin can manage settings
    permission_classes = [permissions.IsAdminUser]
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
