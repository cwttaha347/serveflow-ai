from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    UserViewSet, ProfileViewSet, CategoryViewSet, ProviderViewSet,
    RequestViewSet, JobViewSet, InvoiceViewSet, ReviewViewSet, DisputeViewSet, BidViewSet, AuditLogViewSet,
    MessageViewSet, CustomAuthToken, StripeCheckoutView, StripeWebhookView
)
from .views_settings import SystemSettingsViewSet
from .views_ai import AIImageAnalysisView

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'profiles', ProfileViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'providers', ProviderViewSet)
router.register(r'requests', RequestViewSet)
router.register(r'jobs', JobViewSet, basename='job')
router.register(r'invoices', InvoiceViewSet)
router.register(r'reviews', ReviewViewSet, basename='review')
router.register(r'bids', BidViewSet, basename='bid')
router.register(r'disputes', DisputeViewSet, basename='dispute')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')
router.register(r'settings', SystemSettingsViewSet, basename='settings')
router.register(r'messages', MessageViewSet, basename='message')

urlpatterns = [
    path('requests/ai-analyze/', AIImageAnalysisView.as_view(), name='request-ai-analyze'),
    path('', include(router.urls)),
    path('profile/', UserViewSet.as_view({'get': 'me', 'put': 'me', 'patch': 'me'}), name='profile-detail'),
    path('auth/login/', CustomAuthToken.as_view(), name='api-token-auth'),
    path('auth/change-password/', UserViewSet.as_view({'post': 'change_password'}), name='auth-change-password'),
    path('payments/stripe-checkout/', StripeCheckoutView.as_view(), name='stripe-checkout'),
    path('payments/stripe-webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
]
