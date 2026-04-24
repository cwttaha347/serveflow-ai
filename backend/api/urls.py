from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    UserViewSet, ProfileViewSet, CategoryViewSet, ProviderViewSet,
    RequestViewSet, JobViewSet, InvoiceViewSet, ReviewViewSet, DisputeViewSet, BidViewSet, AuditLogViewSet,
    MessageViewSet, CustomAuthToken, StripeCheckoutView, StripeWebhookView, StripeConfirmView,
    VerificationQueueView, VerificationQueueClaimView, VerificationQueueDecisionView,
    NotificationFeedView, NotificationReadView, WorkerViewSet, WorkerLocationPingViewSet,
    RevenueSplitRuleViewSet, ProviderLedgerEntryViewSet, ProviderPayoutViewSet, ProviderAnalyticsView
)
from .views_settings import SystemSettingsViewSet
from .views_ai import AIImageAnalysisView
from .views_auth import RequestOTPView, VerifyOTPView, RequestEmailVerificationLinkView, VerifyEmailLinkView
from .views_v2 import (
    ServiceRequestCreateView, ServiceRequestSnapshotView, ServiceRequestDecisionView,
    ChatbotDraftSnapshotView, ChatbotPublishView, ChatbotEventView, ChatbotIntentView
)

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
router.register(r'workers', WorkerViewSet, basename='worker')
router.register(r'worker-location', WorkerLocationPingViewSet, basename='worker-location')
router.register(r'revenue-splits', RevenueSplitRuleViewSet, basename='revenue-split')
router.register(r'provider-ledger', ProviderLedgerEntryViewSet, basename='provider-ledger')
router.register(r'provider-payouts', ProviderPayoutViewSet, basename='provider-payout')

urlpatterns = [
    path('requests/ai-analyze/', AIImageAnalysisView.as_view(), name='request-ai-analyze'),
    path('requests/create-v2/', ServiceRequestCreateView.as_view(), name='create-request-v2'),
    path('requests/flow/snapshot/', ServiceRequestSnapshotView.as_view(), name='request-flow-snapshot'),
    path('requests/flow/decision/', ServiceRequestDecisionView.as_view(), name='request-flow-decision'),
    path('chatbot/draft/snapshot/', ChatbotDraftSnapshotView.as_view(), name='chatbot-draft-snapshot'),
    path('chatbot/intent/', ChatbotIntentView.as_view(), name='chatbot-intent'),
    path('chatbot/publish/', ChatbotPublishView.as_view(), name='chatbot-publish'),
    path('chatbot/event/', ChatbotEventView.as_view(), name='chatbot-event'),
    path('providers/analytics/', ProviderAnalyticsView.as_view(), name='provider-analytics'),
    
    # Auth Endpoints
    path('auth/login/', CustomAuthToken.as_view(), name='login'),
    path('auth/request-otp/', RequestOTPView.as_view(), name='otp-request'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='otp-verify'),
    path('auth/verify-email/request/', RequestEmailVerificationLinkView.as_view(), name='verify-email-request'),
    path('auth/verify-email/confirm/', VerifyEmailLinkView.as_view(), name='verify-email-confirm'),

    # Notifications
    path('notifications/feed/', NotificationFeedView.as_view(), name='notification-feed'),
    path('notifications/read/', NotificationReadView.as_view(), name='notification-read'),

    # Verification (Admin)
    path('verification/queue/', VerificationQueueView.as_view(), name='verification-queue'),
    path('verification/queue/claim/', VerificationQueueClaimView.as_view(), name='verification-queue-claim'),
    path('verification/queue/decision/<int:case_id>/', VerificationQueueDecisionView.as_view(), name='verification-queue-decision'),

    # Stripe
    path('payments/stripe-checkout/', StripeCheckoutView.as_view(), name='stripe-checkout'),
    path('stripe/webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    path('payments/stripe-confirm/', StripeConfirmView.as_view(), name='stripe-confirm'),

    path('', include(router.urls)),
]
