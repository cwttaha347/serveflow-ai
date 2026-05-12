from django.utils import timezone
from django.conf import settings
import requests as http_requests
import hashlib
import secrets
from urllib.parse import urljoin
from datetime import timedelta
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import User, Profile, Category, Provider, Request, Job, Invoice, Review, Dispute, SystemSettings, Bid, VerificationBundle, VerificationCase, NotificationItem, PasswordResetToken, Worker, WorkerLocationPing, ProviderLedgerEntry, ProviderPayout, RevenueSplitRule
from .serializers import (
    UserSerializer, UserRegistrationSerializer, ProfileSerializer,
    CategorySerializer, ProviderSerializer, RequestSerializer,
    JobSerializer, InvoiceSerializer, ReviewSerializer, DisputeSerializer, BidSerializer,
    WorkerSerializer, WorkerLocationPingSerializer, ProviderLedgerEntrySerializer, ProviderPayoutSerializer, RevenueSplitRuleSerializer
)
from .serializers import evaluate_profile_completion, evaluate_provider_onboarding
from .utils import calculate_match_score
from .verification import run_ai_verification
from .notifications import notify_request_update, notify_job_update, send_notification
from .audit import log_audit
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from django.db.models import Q, Count, Max
from .payments import create_checkout_session, process_webhook_event, confirm_invoice_payment, execute_provider_payout, _stripe_currency_code
from .tasks import process_verification_case
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.http import FileResponse
from .utils_pdf import generate_invoice_pdf
from .security import (
    can_user_access_job, can_user_update_job_status, apply_job_status_transition,
    require_verified_email, get_provider_for_user, get_worker_for_user,
)
import logging
logger = logging.getLogger(__name__)


def _masked_email_fingerprint(email: str) -> str:
    normalized = str(email or "").strip().lower()
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]

@method_decorator(csrf_exempt, name='dispatch')
class CustomAuthToken(ObtainAuthToken):
    authentication_classes = []
    throttle_scope = "auth_login"

    def post(self, request, *args, **kwargs):
        # Allow login safely with username or email
        username_or_email = request.data.get('username')
        password = request.data.get('password')
        
        user = None
        # Try fetching by username
        if User.objects.filter(username=username_or_email).exists():
           user = User.objects.get(username=username_or_email)
        # Try fetching by email
        elif User.objects.filter(email=username_or_email).exists():
           user = User.objects.get(email=username_or_email)

        if user and user.check_password(password):
            if not user.is_active:
                return Response({'error': 'Invalid credentials'}, status=400)
            token, created = Token.objects.get_or_create(user=user)
            profile_state = evaluate_profile_completion(user)
            provider_state = evaluate_provider_onboarding(user)
            log_audit(
                user=user,
                action='login',
                model_name='User',
                obj=user,
                changes={
                    "profile_completed": profile_state["profile_completed"],
                    "provider_onboarding_completed": provider_state["provider_onboarding_completed"],
                },
                description='User logged in successfully',
                request=request,
            )
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'email': user.email,
                'role': user.role,
                'is_email_verified': user.is_email_verified,
                'profile_completed': profile_state['profile_completed'],
                'missing_required_fields': profile_state['missing_required_fields'],
                'onboarding_required': not profile_state['profile_completed'],
                'provider_onboarding_completed': provider_state['provider_onboarding_completed'],
                'provider_onboarding_required': provider_state['provider_onboarding_required'],
            })
        
        return Response({'error': 'Invalid credentials'}, status=400)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)
    def get_permissions(self):
        if self.action in {'create', 'forgot_password', 'reset_password'}:
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        role = str(request.data.get("role") or "user").strip().lower()
        if role == "admin":
            return Response({"error": "Invalid role selection."}, status=400)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        user = serializer.instance
        token, _ = Token.objects.get_or_create(user=user)
        profile_state = evaluate_profile_completion(user)
        provider_state = evaluate_provider_onboarding(user)
        log_audit(
            user=user,
            action='create',
            model_name='User',
            obj=user,
            changes={"role": user.role},
            description='User account created',
            request=request,
        )

        # TRIGGER VERIFICATION EMAIL ON SIGNUP
        if getattr(settings, 'ENABLE_EMAIL_OTP', True):
            try:
                from .tasks import send_otp_email
                # Generate 6-digit OTP for immediate use
                import secrets
                otp = str(secrets.randbelow(1_000_000)).zfill(6)
                from django.contrib.auth.hashers import make_password
                from .models import EmailOTP
                from datetime import timedelta
                
                expires_at = timezone.now() + timedelta(seconds=getattr(settings, 'OTP_EXPIRY_SECONDS', 600))
                EmailOTP.objects.create(
                    user=user,
                    otp_hash=make_password(otp),
                    expires_at=expires_at,
                    ip_address=request.META.get('REMOTE_ADDR')
                )
                send_otp_email.delay(user.email, otp)
                logger.info(f"Auto-sent signup OTP to {user.email}")
            except Exception as e:
                logger.error(f"Failed to auto-send signup OTP: {e}")

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'token': token.key,
            'profile_completed': profile_state['profile_completed'],
            'missing_required_fields': profile_state['missing_required_fields'],
            'onboarding_required': not profile_state['profile_completed'],
            'provider_onboarding_completed': provider_state['provider_onboarding_completed'],
            'provider_onboarding_required': provider_state['provider_onboarding_required'],
        }, status=201)
    
    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """Get or update current user info"""
        if request.method == 'GET':
            serializer = self.get_serializer(request.user)
            return Response(serializer.data)
        
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def forgot_password(self, request):
        email = str(request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'error': 'Email is required'}, status=400)

        generic_message = {'message': 'If an account exists, a reset link has been sent.'}
        request_id = str(request.headers.get('X-Request-Id') or '').strip()[:80]
        email_fp = _masked_email_fingerprint(email)
        try:
            user = User.objects.get(email=email)
            from .emails import send_resilient_mail
            # Basic anti-abuse throttle per account.
            cutoff = timezone.now() - timedelta(minutes=5)
            if PasswordResetToken.objects.filter(user=user, created_at__gte=cutoff).exists():
                logger.info(
                    "forgot_password_outcome reason=cooldown_skip user_id=%s email_fp=%s request_id=%s",
                    user.id,
                    email_fp,
                    request_id,
                )
                return Response(generic_message)
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            expires_at = timezone.now() + timedelta(hours=1)
            PasswordResetToken.objects.create(user=user, token_hash=token_hash, expires_at=expires_at)
            front = str(getattr(settings, 'FRONTEND_URL', '') or '').strip().rstrip('/')
            if not front:
                logger.error(
                    "forgot_password_outcome reason=missing_frontend_url user_id=%s email_fp=%s request_id=%s",
                    user.id,
                    email_fp,
                    request_id,
                )
                return Response(generic_message)
            reset_link = urljoin(f"{front}/", f"reset-password?token={raw_token}")
            
            subject = 'Password Reset - ServeFlow AI'
            message = f'Click the link to reset your password: {reset_link}'
            
            sent = send_resilient_mail(
                subject,
                message,
                [email],
                log_context={
                    "flow": "forgot_password",
                    "user_id": user.id,
                    "email_fp": email_fp,
                    "request_id": request_id,
                },
            )
            if not sent:
                logger.error(
                    "forgot_password_outcome reason=email_send_failed user_id=%s email_fp=%s request_id=%s",
                    user.id,
                    email_fp,
                    request_id,
                )
            else:
                logger.info(
                    "forgot_password_outcome reason=email_sent user_id=%s email_fp=%s request_id=%s",
                    user.id,
                    email_fp,
                    request_id,
                )
            return Response(generic_message)
        except User.DoesNotExist:
            logger.info("forgot_password_outcome reason=user_not_found email_fp=%s request_id=%s", email_fp, request_id)
            return Response(generic_message)
        except Exception as e:
            logger.exception(
                "forgot_password_outcome reason=unexpected_error email_fp=%s request_id=%s error=%s",
                email_fp,
                request_id,
                str(e),
            )
            return Response(generic_message)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def reset_password(self, request):
        token = request.data.get('token')
        new_password = request.data.get('password')

        if not token or not new_password:
            return Response({'error': 'Reset token and new password are required'}, status=400)

        try:
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            token_obj = PasswordResetToken.objects.select_related('user').filter(
                token_hash=token_hash,
                is_used=False,
                expires_at__gt=timezone.now(),
            ).first()
            if not token_obj:
                return Response({'error': 'Invalid or expired reset token'}, status=400)
            user = token_obj.user
            user.set_password(new_password)
            user.save()
            token_obj.is_used = True
            token_obj.used_at = timezone.now()
            token_obj.save(update_fields=['is_used', 'used_at'])
            PasswordResetToken.objects.filter(user=user, is_used=False).exclude(id=token_obj.id).update(
                is_used=True, used_at=timezone.now()
            )
            return Response({'message': 'Password has been reset successfully'})
        except Exception:
            return Response({'error': 'Invalid request'}, status=400)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not request.user.check_password(old_password):
            return Response({'error': 'Current password is incorrect'}, status=400)
        
        request.user.set_password(new_password)
        request.user.save()
        return Response({'message': 'Password updated successfully'})

class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        if request.method == 'GET':
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
        
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as exc:
            return Response(
                {
                    "error": "Unable to save profile details.",
                    "field_errors": exc.detail,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(serializer.data)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return []
        return [IsAuthenticated()]

    @action(detail=False, methods=['post'])
    def diagnose(self, request):
        """AI based categorization from description"""
        desc = request.data.get('description', '').lower()
        if not desc:
            return Response({'error': 'Description required'}, status=400)
            
        categories = Category.objects.filter(is_active=True)
        best_match = None
        
        # Advanced keyword mapping
        category_map = {
            'plumbing': ['leak', 'pipe', 'toilet', 'sink', 'tap', 'water', 'drain', 'clog', 'shower', 'basin', 'flush'],
            'electrical': ['wire', 'light', 'short', 'circuit', 'power', 'switch', 'spark', 'breaker', 'plugin', 'voltage', 'shock'],
            'cleaning': ['dust', 'wash', 'mop', 'house', 'office', 'dirty', 'deep clean', 'vacuum', 'scrub', 'mess'],
            'painting': ['wall', 'color', 'brush', 'coat', 'stain', 'renovation', 'interior', 'exterior', 'primer'],
            'carpentry': ['wood', 'furniture', 'door', 'shelf', 'cabinet', 'fix', 'table', 'chair', 'hammer', 'nail'],
            'hvac': ['ac', 'air', 'condition', 'heat', 'cool', 'filter', 'vent', 'duct', 'thermostat', 'chiller']
        }
        
        # Simple keyword matching
        for cat in categories:
            cat_name_low = cat.name.lower()
            keywords = category_map.get(cat_name_low, [cat_name_low])
            
            for word in keywords:
                if word in desc:
                    best_match = cat
                    break
            if best_match: break
            
        if best_match:
            return Response({
                'category_id': best_match.id,
                'category_name': best_match.name,
                'confidence': 0.85,
                'summary': f"Based on your description, this appears to be a {best_match.name} issue."
            })
            
        return Response({
            'category_id': None,
            'summary': "We couldn't automatically determine the category. Please select one manually."
        })

class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        try:
            provider = request.user.provider_profile
        except Provider.DoesNotExist:
            return Response({'error': 'Provider profile not found'}, status=404)
            
        if request.method == 'GET':
            serializer = self.get_serializer(provider)
            return Response(serializer.data)
        
        serializer = self.get_serializer(provider, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def recommendations(self, request):
        """
        Get recommended providers based on request criteria.
        Expects: { title, description, category, address }
        """
        data = request.data
        
        # Filter active providers
        providers = Provider.objects.filter(availability_status='available')
        
        scored_providers = []
        for provider in providers:
            score = calculate_match_score(data, provider)
            if score > 0:
                serialized = self.get_serializer(provider).data
                serialized['match_score'] = score
                scored_providers.append(serialized)
        
        scored_providers.sort(key=lambda x: x['match_score'], reverse=True)
        return Response(scored_providers[:10])

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def skill_suggestions(self, request):
        try:
            provider = request.user.provider_profile
        except Provider.DoesNotExist:
            return Response({'error': 'Only providers can request skill suggestions'}, status=403)

        category_ids = request.data.get('category_ids') or list(provider.categories.values_list('id', flat=True))
        if not category_ids:
            return Response({'error': 'Select at least one category first.'}, status=400)
        categories = list(Category.objects.filter(id__in=category_ids, is_active=True).values_list('name', flat=True))
        if not categories:
            return Response({'error': 'No valid categories selected.'}, status=400)

        ai_url = f"{settings.AI_SERVICE_URL.rstrip('/')}/ai/provider-skill-suggestions"
        fallback_map = {
            "Plumbing": ["Leak Detection", "Pipe Repair", "Drain Cleaning", "Fixture Installation"],
            "Electrical": ["Wiring", "Circuit Troubleshooting", "Panel Upgrade", "Safety Inspection"],
            "Cleaning": ["Deep Cleaning", "Sanitization", "Move-in Cleanup", "Post-renovation Cleaning"],
            "HVAC": ["AC Service", "Duct Cleaning", "Thermostat Setup", "Cooling Diagnostics"],
            "Painting": ["Interior Painting", "Surface Prep", "Texture Repair", "Protective Coating"],
            "Carpentry": ["Wood Repair", "Cabinet Work", "Door Installation", "Custom Shelving"],
        }
        skills = []
        try:
            response = http_requests.post(ai_url, json={"categories": categories}, timeout=15)
            response.raise_for_status()
            data = response.json()
            skills = data.get("skills", [])
        except Exception:
            for cat in categories:
                skills.extend(fallback_map.get(cat, [f"{cat} Service Delivery", f"{cat} Troubleshooting"]))

        deduped = []
        for skill in skills:
            normalized = str(skill).strip()
            if normalized and normalized not in deduped:
                deduped.append(normalized)

        return Response({"categories": categories, "skills": deduped[:20]})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def complete_onboarding(self, request):
        try:
            provider = request.user.provider_profile
        except Provider.DoesNotExist:
            return Response({'error': 'Only providers can complete provider onboarding'}, status=403)
        if not request.user.is_email_verified:
            return Response({'error': 'Verify your email before completing onboarding.'}, status=403)

        category_ids = request.data.get('category_ids') or []
        categories = Category.objects.filter(id__in=category_ids, is_active=True)
        if not categories.exists():
            return Response({'error': 'At least one valid category is required.'}, status=400)

        skills = request.data.get('skills') or []
        if not isinstance(skills, list) or len(skills) < 2:
            return Response({'error': 'At least two skills are required.'}, status=400)

        provider.categories.set(categories)
        provider.skills = [str(s).strip() for s in skills if str(s).strip()][:30]
        provider.bio = request.data.get('bio', provider.bio or '')
        provider.experience_years = int(request.data.get('experience_years') or provider.experience_years or 0)
        provider.onboarding_completed = True
        # Auto-verify provider on onboarding completion
        provider.verified = True
        provider.verification_status = 'verified'
        provider.save()

        log_audit(
            user=request.user,
            action='update',
            model_name='Provider',
            obj=provider,
            changes={
                "categories": list(categories.values_list('name', flat=True)),
                "skills_count": len(provider.skills),
                "onboarding_completed": True,
            },
            description='Provider completed onboarding with category-based skills',
            request=request,
        )
        serializer = self.get_serializer(provider)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], url_path='stripe-connect/onboarding')
    def stripe_connect_onboarding(self, request):
        try:
            provider = request.user.provider_profile
        except Provider.DoesNotExist:
            return Response({'error': 'Only providers can connect payouts'}, status=403)
        from .payments import create_connect_onboarding_link
        front = str(getattr(settings, 'FRONTEND_URL', '') or '').strip().rstrip('/')
        if not front:
            return Response({'error': 'FRONTEND_URL is not configured'}, status=500)
        refresh_url = request.data.get('refresh_url') or f"{front}/dashboard/provider/profile?stripe_refresh=1"
        return_url = request.data.get('return_url') or f"{front}/dashboard/provider/profile?stripe_return=1"
        try:
            url = create_connect_onboarding_link(provider, refresh_url, return_url)
        except Exception as e:
            msg = str(e)
            lower = msg.lower()
            # Stripe returns this when the platform account hasn't enabled Connect.
            if 'signed up for connect' in lower or '/connect' in lower:
                return Response({
                    'error': "Stripe Connect is not enabled on this Stripe account yet. Enable Connect in your Stripe dashboard, then try again.",
                    'code': 'CONNECT_NOT_ENABLED',
                    'action_url': 'https://dashboard.stripe.com/connect',
                }, status=400)
            return Response({'error': msg}, status=500)
        return Response({'url': url})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='stripe-connect/status')
    def stripe_connect_status(self, request):
        try:
            provider = request.user.provider_profile
        except Provider.DoesNotExist:
            return Response({'error': 'Only providers have payout status'}, status=403)
        # Attempt a lightweight reconcile so stale DB flags do not block eligible providers.
        try:
            from .payments import sync_connect_status
            sync_connect_status(provider)
        except Exception:
            # Status endpoint should not hard-fail on transient Stripe issues.
            pass
        return Response({
            'stripe_connect_account_id': provider.stripe_connect_account_id,
            'onboarding_complete': bool(provider.stripe_connect_onboarding_complete),
        })

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def verify_bundle(self, request):
        """
        Submit ID and selfie for AI-powered Trust Audit.
        """
        try:
            provider = request.user.provider_profile
        except Provider.DoesNotExist:
            return Response({'error': 'Only providers can verify'}, status=403)
        if not request.user.is_email_verified:
            return Response({'error': 'Verify your email before submitting verification.'}, status=403)

        id_front = request.FILES.get('id_front')
        id_back = request.FILES.get('id_back')
        selfie = request.FILES.get('selfie')
        cert = request.FILES.get('certificate')

        if not id_front or not selfie:
            return Response({'error': 'ID Front and Selfie are required'}, status=400)

        # Create Bundle
        bundle, created = VerificationBundle.objects.get_or_create(
            provider=provider,
            defaults={'status': 'PROCESSING'}
        )
        bundle.id_front = id_front
        bundle.id_back = id_back
        bundle.selfie_with_id = selfie
        bundle.certificate = cert
        bundle.status = 'PROCESSING'
        bundle.save()

        idem_key = str(request.data.get('idempotency_key') or request.headers.get('X-Idempotency-Key') or f"provider-{provider.id}-bundle-{bundle.id}").strip()[:64]
        case, _ = VerificationCase.objects.get_or_create(
            provider=provider,
            bundle=bundle,
            idempotency_key=idem_key,
            defaults={'status': 'SUBMITTED'},
        )
        if case.status in ['SUBMITTED', 'PROCESSING', 'REVIEW_REQUIRED']:
            process_verification_case.delay(case.id)
        return Response({
            'case_id': case.id,
            'status': case.status,
            'bundle_status': bundle.status,
            'queued': True,
        }, status=202)

class RequestViewSet(viewsets.ModelViewSet):
    queryset = Request.objects.all()
    serializer_class = RequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return qs.none()
        if getattr(user, "role", None) == "admin":
            return qs
        return qs.filter(user=user)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Professional cancel policy:
        - Allowed only for the request owner (or admin).
        - Allowed only if there is no accepted/started/completed job.
        - Transitions request to cancelled and cancels pending jobs.
        """
        service_request = self.get_object()
        user = request.user
        if getattr(user, "role", None) != "admin" and service_request.user_id != user.id:
            return Response({"error": "Forbidden"}, status=403)

        active_job = service_request.jobs.filter(status__in=["accepted", "started", "completed"]).first()
        if active_job:
            return Response(
                {"error": "Cannot cancel a request that is already in progress.", "code": "CANNOT_CANCEL_ACTIVE_JOB"},
                status=409,
            )

        if service_request.status in ["completed", "cancelled"]:
            return Response(
                {"status": service_request.status, "message": "No changes."},
                status=200,
            )

        service_request.status = "cancelled"
        service_request.save(update_fields=["status", "updated_at"])
        Job.objects.filter(request=service_request, status="pending").update(status="cancelled")
        notify_request_update(service_request, f"Request '{service_request.title}' was cancelled by the customer.")
        return Response({"status": "cancelled"}, status=200)
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        
        # Check for associated job
        job = instance.jobs.filter(status__in=['accepted', 'started', 'completed']).first()
        job_data = JobSerializer(job).data if job else None
        
        # Check for review
        has_review = False
        if job:
            has_review = Review.objects.filter(job=job).exists()

        # Get linked requests (from same group split)
        linked_requests = []
        if instance.group_id:
            linked_qs = Request.objects.filter(group_id=instance.group_id).exclude(id=instance.id)
            linked_requests = RequestSerializer(linked_qs, many=True).data
            
        return Response({
            'request': serializer.data,
            'job': job_data,
            'hasReview': has_review,
            'linked_requests': linked_requests
        })

    def perform_create(self, serializer):
        """DEPRECATED: v1 request creation. Use /requests/flow/decision/ (v2) instead."""
        return Response(
            {'error': 'This endpoint is deprecated. Use /api/requests/flow/decision/ instead.'},
            status=status.HTTP_410_GONE
        )
    
    @action(detail=False, methods=['get'])
    def open_requests(self, request):
        """Get requests that are open for bidding"""
        open_reqs = Request.objects.filter(status='open_for_bids')
        serializer = self.get_serializer(open_reqs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def ai_match(self, request, pk=None):
        """
        Match request with best providers using AI scoring.
        CRITICAL: Only matches providers in the SAME category.
        """
        service_request = self.get_object()
        
        # Validate request has category
        if not service_request.category:
            from rest_framework import status
            return Response({
                'error': 'Request must have a category assigned',
                'request_id': service_request.id
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get ONLY providers in the SAME category
        providers = Provider.objects.filter(
            categories=service_request.category
        )
        
        if not providers.exists():
            from rest_framework import status
            return Response({
                'error': f'No {service_request.category.name} providers found',
                'category': service_request.category.name,
                'suggestion': 'Please try again later or contact support'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Score each provider
        from .utils import calculate_match_score, calculate_distance
        
        scored_providers = []
        for provider in providers:
            match_score = calculate_match_score(service_request, provider)
            
            # Calculate distance if coordinates available (from User Profile)
            prov_lat = None
            prov_lon = None
            if hasattr(provider.user, 'profile'):
                prov_lat = provider.user.profile.latitude
                prov_lon = provider.user.profile.longitude

            distance = None
            if (service_request.latitude and service_request.longitude and 
                prov_lat and prov_lon):
                distance = calculate_distance(
                    service_request.latitude,
                    service_request.longitude,
                    prov_lat,
                    prov_lon
                )
            
            scored_providers.append({
                'provider_id': provider.id,
                'provider_name': provider.user.get_full_name() or provider.user.username,
                'rating': float(provider.rating or 0),
                'match_score': match_score,
                'distance_km': distance,
                'availability': getattr(provider, 'availability_status', 'unknown'),
                'category': service_request.category.name # Use the request's category name as primary
            })
        
        # Sort by match score (highest first)
        scored_providers.sort(key=lambda x: x['match_score'], reverse=True)
        
        # Return top 10 matches
        top_matches = scored_providers[:10]
        
        return Response({
            'request_id': service_request.id,
            'request_category': service_request.category.name,
            'total_providers_in_category': len(scored_providers),
            'matched_providers': top_matches,
            'message': f'Found {len(top_matches)} {service_request.category.name} providers'
        })
    
    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        requests = Request.objects.filter(user=request.user)
        serializer = self.get_serializer(requests, many=True)
        return Response(serializer.data)

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Invoice.objects.all()
        if user.role == 'provider':
            provider = get_provider_for_user(user)
            return Invoice.objects.filter(job__provider=provider) if provider else Invoice.objects.none()
        if user.role == 'worker':
            worker = get_worker_for_user(user)
            return Invoice.objects.filter(job__assigned_worker=worker) if worker else Invoice.objects.none()
        return Invoice.objects.filter(job__request__user=user)
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark invoice as paid"""
        invoice = self.get_object()
        if request.user.role not in ['admin', 'user']:
            return Response({'error': 'Forbidden'}, status=403)
        if request.user.role == 'user' and invoice.job.request.user_id != request.user.id:
            return Response({'error': 'Forbidden'}, status=403)
        payment_method = request.data.get('payment_method', 'cash')
        
        invoice.paid = True
        invoice.paid_at = timezone.now()
        invoice.payment_method = payment_method
        invoice.save()
        
        return Response({
            'status': 'success',
            'message': 'Invoice marked as paid',
            'payment_date': invoice.paid_at
        })

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Generate and download professional PDF invoice"""
        invoice = self.get_object()
        pdf_buffer = generate_invoice_pdf(invoice)
        filename = f"Invoice_{invoice.id:06d}.pdf"
        
        return FileResponse(
            pdf_buffer, 
            as_attachment=True, 
            filename=filename,
            content_type='application/pdf'
        )

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        job_id = self.request.data.get('job_id')
        if not job_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Job ID is required")
            
        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Job not found")
            
        # Verify user is the customer
        if job.request.user != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the customer can leave a review")
            
        # verify job is completed
        if job.status != 'completed':
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Can only review completed jobs")
            
        # Save review
        review = serializer.save(job=job)
        
        # Update provider rating
        self._update_provider_rating(job.provider)
        
    def _update_provider_rating(self, provider):
        # Calculate new average
        reviews = Review.objects.filter(job__provider=provider)
        if reviews.exists():
            avg_rating = sum(r.rating for r in reviews) / reviews.count()
            provider.rating = round(avg_rating, 2)
            provider.save()
            print(f"DEBUG: Updated provider {provider.user.username} rating to {provider.rating}")

class DisputeViewSet(viewsets.ModelViewSet):
    queryset = Dispute.objects.all()
    serializer_class = DisputeSerializer
    permission_classes = [IsAuthenticated]

class BidViewSet(viewsets.ModelViewSet):
    queryset = Bid.objects.all()
    serializer_class = BidSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Bid.objects.all()
        elif user.role == 'provider':
            try:
                provider = Provider.objects.get(user=user)
                return Bid.objects.filter(provider=provider)
            except Provider.DoesNotExist:
                return Bid.objects.none()
        else:
            return Bid.objects.filter(request__user=user)
    
    def perform_create(self, serializer):
        try:
            provider = Provider.objects.get(user=self.request.user)
            bid = serializer.save(provider=provider)
            
            # Send email notification to customer
            from .emails import send_new_bid_notification
            try:
                send_new_bid_notification(bid)
            except Exception as e:
                print(f"Email notification failed: {e}")
                
        except Provider.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Only providers can create bids")
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        bid = self.get_object()
        if bid.request.user != request.user:
            return Response({'error': 'Only request owner can accept bids'}, status=403)
        if bid.status != 'pending':
            return Response({'error': 'Bid already processed'}, status=400)
        
        bid.status = 'accepted'
        bid.save()
        
        job = Job.objects.create(request=bid.request, provider=bid.provider, status='accepted')
        bid.request.status = 'assigned'
        bid.request.save()
        
        Bid.objects.filter(request=bid.request, status='pending').exclude(id=bid.id).update(status='rejected')
        
        # Real-time Notification to Provider
        notify_job_update(job, f"Your bid on '{bid.request.title}' was accepted! Protocol initiated.", bid.provider.user)
        
        return Response({'message': 'Bid accepted', 'job_id': job.id})
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        bid = self.get_object()
        if bid.request.user != request.user:
            return Response({'error': 'Only request owner can reject bids'}, status=403)
        if bid.status != 'pending':
            return Response({'error': 'Bid already processed'}, status=400)
        bid.status = 'rejected'
        bid.save()
        return Response({'message': 'Bid rejected'})
    
    @action(detail=True, methods=['delete'])
    def withdraw(self, request, pk=None):
        bid = self.get_object()
        if bid.provider.user != request.user:
            return Response({'error': 'You can only withdraw your own bids'}, status=403)
        if bid.status != 'pending':
            return Response({'error': 'Can only withdraw pending bids'}, status=400)
        bid.status = 'withdrawn'
        bid.save()
        return Response({'message': 'Bid withdrawn'})


class JobViewSet(viewsets.ModelViewSet):
    serializer_class = JobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Job.objects.all()
        if user.role == 'provider':
            provider = get_provider_for_user(user)
            return Job.objects.filter(provider=provider) if provider else Job.objects.none()
        if user.role == 'worker':
            worker = get_worker_for_user(user)
            return Job.objects.filter(assigned_worker=worker) if worker else Job.objects.none()
        return Job.objects.filter(request__user=user)

    def perform_update(self, serializer):
        instance = self.get_object()
        
        # Security: check if user can access this job
        if not can_user_access_job(self.request.user, instance):
            raise ValidationError("Search warrant denied. You cannot access this mission.")
            
        requested_status = serializer.validated_data.get('status')
        if requested_status and requested_status != instance.status:
            if not can_user_update_job_status(self.request.user, instance):
                raise ValidationError("Unauthorized access attempt. Status modification blocked.")
            
            # Apply transition via security helper
            apply_job_status_transition(instance, requested_status, self.request.user, note='System patch update')
            # Pop status so serializer.save() doesn't try to update it again (potentially with old data or side-stepping the transition logic)
            serializer.validated_data.pop('status', None)
            
            # Notify Customer of change
            from .notifications import notify_job_update
            notify_job_update(instance, "Mission status updated.", instance.request.user)

        instance = serializer.save()
        if instance.status == 'completed' and instance.provider_earnings == 0:
            self._calculate_earnings(instance)

    def _calculate_earnings(self, instance):
        settings = SystemSettings.get_settings()
        amount = instance.request.budget or 0
        commission_amount = (amount * settings.commission_percentage) / 100
        instance.commission_rate = settings.commission_percentage
        instance.provider_earnings = amount - commission_amount
        instance.save()
        if getattr(instance.request, 'escrow_status', 'not_required') in ('funded', 'released'):
            return
        if not ProviderLedgerEntry.objects.filter(job=instance, entry_type='hold').exists():
            ProviderLedgerEntry.objects.create(
                provider=instance.provider,
                job=instance,
                entry_type='hold',
                amount=instance.provider_earnings,
                currency='USD',
                note='Held until invoice payment confirmation',
            )

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        job = self.get_object()
        require_verified_email(request.user, message="Verify comms channel before accepting missions.")
        
        if not can_user_update_job_status(request.user, job):
            return Response({'error': 'Unauthorized mission acceptance'}, status=403)
            
        # Transition to accepted
        apply_job_status_transition(job, 'accepted', request.user, note='Mission accepted by provider')
        
        # Link Request
        job.request.status = 'assigned'
        job.request.save()
        
        # Cancel other competing jobs for this request
        Job.objects.filter(request=job.request, status='pending').exclude(id=job.id).update(status='cancelled')
        
        # Notify relevant parties
        from .notifications import notify_job_update, notify_request_update
        # notify_request_update handles notifying the customer
        notify_request_update(job.request, message=f"Mission initialized by {request.user.username}")
        
        return Response({'status': 'Mission Initialized', 'job_status': job.status})

    @action(detail=True, methods=['post'])
    def assign_worker(self, request, pk=None):
        job = self.get_object()
        if request.user.role != 'provider':
            return Response({'error': 'Only providers can assign workers'}, status=403)
        provider = get_provider_for_user(request.user)
        if not provider or job.provider_id != provider.id:
            return Response({'error': 'Forbidden'}, status=403)
        worker_id = request.data.get('worker_id')
        worker = Worker.objects.filter(id=worker_id, provider=provider, status='active').first()
        if not worker:
            return Response({'error': 'Worker not found or inactive'}, status=404)
        job.assigned_worker = worker
        job.save(update_fields=['assigned_worker', 'updated_at'])
        return Response({'status': 'assigned', 'worker_id': worker.id})

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        job = self.get_object()
        if not can_user_update_job_status(request.user, job):
            return Response({'error': 'Forbidden'}, status=403)
        apply_job_status_transition(job, 'started', request.user, note='Job started')
        if job.request.status != 'in_progress':
            job.request.status = 'in_progress'
            job.request.save(update_fields=['status', 'updated_at'])
        
        # Notify Customer
        notify_request_update(job.request, f"Work has started on '{job.request.title}'")
        
        return Response({'status': 'job started'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        job = self.get_object()
        if not can_user_update_job_status(request.user, job):
            return Response({'error': 'Forbidden'}, status=403)
        apply_job_status_transition(job, 'completed', request.user, note='Job completed')
        
        # Calculate earnings
        self._calculate_earnings(job)
        
        # Update request status to completed
        job.request.status = 'completed'
        job.request.save()
        
        # Notify Customer
        notify_request_update(job.request, f"Job '{job.request.title}' has been completed!")

        if getattr(job.request, 'escrow_status', 'not_required') == 'funded':
            from .payments import try_release_escrow_to_provider
            try_release_escrow_to_provider(job)

        invoice_created = False
        if getattr(job.request, 'escrow_status', 'not_required') not in ('funded', 'released'):
            if not hasattr(job, 'invoice'):
                try:
                    budget = job.request.budget or 0
                    sys_settings = SystemSettings.get_settings()
                    tax_amount = (budget * sys_settings.tax_percentage) / 100
                    Invoice.objects.create(
                        job=job,
                        subtotal=budget,
                        tax=tax_amount,
                        discount=0,
                        total=budget + tax_amount,
                        paid=False
                    )
                    invoice_created = True
                except Exception as e:
                    print(f"DEBUG: Error creating invoice: {e}")

        return Response({'status': 'job completed', 'invoice_created': invoice_created})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        job = self.get_object()
        if not can_user_update_job_status(request.user, job):
            return Response({'error': 'Forbidden'}, status=403)
        apply_job_status_transition(job, 'cancelled', request.user, note='Job cancelled')
        # Real-time Notification
        other_party = job.request.user if request.user == job.provider.user else job.provider.user
        notify_job_update(job, f"Job '{job.request.title}' has been cancelled.", other_party)
        
        return Response({'status': 'job cancelled'})


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Admin-only viewset for viewing audit logs.
    Read-only - logs cannot be modified or deleted.
    """
    from .audit import AuditLog
    from .audit_serializer import AuditLogSerializer
    
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Only admins can view audit logs
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only administrators can view audit logs")
        
        queryset = self.queryset
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by model
        model_name = self.request.query_params.get('model')
        if model_name:
            queryset = queryset.filter(model_name=model_name)
        
        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if from_date:
            queryset = queryset.filter(timestamp__gte=from_date)
        if to_date:
            queryset = queryset.filter(timestamp__lte=to_date)
        
from .models import Message
from .serializers import MessageSerializer

class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated] # Messages are private business

    def get_serializer_class(self):
        # Local import or use the one from serializers.py if available
        # But for now, we rely on the import at top of file, so we need to add it there too.
        # However, to be cleaner, we can import inside method or assume it is imported.
        # Since I cannot easily edit top imports without risk, I will add it here.
        from .serializers import MessageSerializer
        return MessageSerializer

    def get_queryset(self):
        # Users can only see messages they sent or received
        user = self.request.user
        job_id = self.request.query_params.get('job_id')
        
        queryset = Message.objects.filter(
            Q(sender=user) | Q(receiver=user)
        )
        
        if job_id:
            queryset = queryset.filter(job_id=job_id)
            
        return queryset

    def perform_create(self, serializer):
        # Auto-set sender
        serializer.save(sender=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        job_id = request.data.get('job_id')
        if not job_id:
             return Response({'error': 'Job ID required'}, status=400)
             
        # Mark all messages in this job received by current user as read
        updated = Message.objects.filter(
            job_id=job_id,
            receiver=request.user,
            is_read=False
        ).update(is_read=True)
        
        return Response({'status': 'success', 'updated': updated})

    @action(detail=False, methods=['get'])
    def unread_summary(self, request):
        unread_qs = Message.objects.filter(receiver=request.user, is_read=False)
        by_job = (
            unread_qs.values('job_id')
            .annotate(unread_count=Count('id'), latest_at=Max('created_at'))
            .order_by('-latest_at')
        )
        return Response({
            "total_unread": unread_qs.count(),
            "jobs": list(by_job),
        })


class WorkerViewSet(viewsets.ModelViewSet):
    queryset = Worker.objects.select_related('user', 'provider').all()
    serializer_class = WorkerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return self.queryset
        if user.role == 'provider':
            provider = get_provider_for_user(user)
            return self.queryset.filter(provider=provider) if provider else Worker.objects.none()
        if user.role == 'worker':
            worker = get_worker_for_user(user)
            return self.queryset.filter(id=worker.id) if worker else Worker.objects.none()
        return Worker.objects.none()

    def perform_create(self, serializer):
        if self.request.user.role != 'provider':
            raise ValidationError("Only providers can create workers")
        provider = get_provider_for_user(self.request.user)
        if not provider:
            raise ValidationError("Provider profile is required")
        serializer.save(provider=provider)


class WorkerLocationPingViewSet(viewsets.ModelViewSet):
    queryset = WorkerLocationPing.objects.select_related('worker', 'job').all()
    serializer_class = WorkerLocationPingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = self.queryset
        if user.role == 'admin':
            return base
        if user.role == 'provider':
            provider = get_provider_for_user(user)
            return base.filter(worker__provider=provider) if provider else WorkerLocationPing.objects.none()
        if user.role == 'worker':
            worker = get_worker_for_user(user)
            return base.filter(worker=worker) if worker else WorkerLocationPing.objects.none()
        return base.filter(job__request__user=user)

    def perform_create(self, serializer):
        user = self.request.user
        worker = get_worker_for_user(user)
        if not worker and user.role == 'provider':
            worker_id = self.request.data.get('worker')
            worker = Worker.objects.filter(id=worker_id, provider=get_provider_for_user(user)).first()
        if not worker:
            raise ValidationError("Only assigned workers/providers can submit location pings")
        serializer.save(worker=worker)


class RevenueSplitRuleViewSet(viewsets.ModelViewSet):
    queryset = RevenueSplitRule.objects.all()
    serializer_class = RevenueSplitRuleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return self.queryset
        if user.role == 'provider':
            provider = get_provider_for_user(user)
            return self.queryset.filter(Q(scope='global') | Q(provider=provider))
        return RevenueSplitRule.objects.filter(scope='global', is_active=True)


class ProviderLedgerEntryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProviderLedgerEntry.objects.select_related('provider', 'job', 'invoice').all()
    serializer_class = ProviderLedgerEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return self.queryset
        provider = get_provider_for_user(user)
        if provider:
            return self.queryset.filter(provider=provider)
        worker = get_worker_for_user(user)
        if worker:
            return self.queryset.filter(provider=worker.provider)
        return ProviderLedgerEntry.objects.none()


class ProviderPayoutViewSet(viewsets.ModelViewSet):
    queryset = ProviderPayout.objects.select_related('provider').all()
    serializer_class = ProviderPayoutSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return self.queryset
        provider = get_provider_for_user(user)
        return self.queryset.filter(provider=provider) if provider else ProviderPayout.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ['provider', 'admin']:
            raise ValidationError("Forbidden")
        provider = serializer.validated_data.get('provider') if user.role == 'admin' else get_provider_for_user(user)
        if not provider:
            raise ValidationError("Provider is required")
        amount = serializer.validated_data.get('amount')
        sys_settings = SystemSettings.get_settings()
        if amount < sys_settings.min_payout_amount:
            raise ValidationError(f"Minimum payout amount is {sys_settings.min_payout_amount}")
        # Ensure provider has enough available balance (earned - paid_out).
        ledger = ProviderLedgerEntry.objects.filter(provider=provider)
        earned = sum(float(x.amount) for x in ledger.filter(entry_type='earned'))
        paid_out = sum(float(x.amount) for x in ledger.filter(entry_type='payout'))
        available = earned - paid_out
        if float(amount) > float(available):
            raise ValidationError(f"Insufficient balance. Available: {round(available, 2)}")

        currency = str(serializer.validated_data.get('currency') or '').strip() or _stripe_currency_code().upper()
        payout = serializer.save(provider=provider, currency=currency)

        # Auto-process through Stripe Connect if onboarded; otherwise keep pending (manual ops).
        if provider.stripe_connect_onboarding_complete and provider.stripe_connect_account_id:
            try:
                execute_provider_payout(payout)
            except Exception as exc:
                payout.status = 'failed'
                payout.save(update_fields=['status'])
                raise ValidationError(str(exc))

    def perform_update(self, serializer):
        payout = serializer.save()
        if payout.status == 'paid' and not ProviderLedgerEntry.objects.filter(
            provider=payout.provider, entry_type='payout', note__icontains=f"Payout #{payout.id}"
        ).exists():
            ProviderLedgerEntry.objects.create(
                provider=payout.provider,
                entry_type='payout',
                amount=payout.amount,
                currency=payout.currency,
                note=f'Payout #{payout.id}',
            )


class ProviderAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['admin', 'provider']:
            return Response({'error': 'Forbidden'}, status=403)

        provider = None
        if request.user.role == 'provider':
            provider = get_provider_for_user(request.user)
        else:
            provider_id = request.query_params.get('provider_id')
            provider = Provider.objects.filter(id=provider_id).first() if provider_id else None
        if not provider:
            return Response({'error': 'Provider not found'}, status=404)

        jobs = Job.objects.filter(provider=provider)
        total_jobs = jobs.count()
        completed_jobs = jobs.filter(status='completed').count()
        cancelled_jobs = jobs.filter(status='cancelled').count()
        avg_rating = float(provider.rating or 0)
        ledger = ProviderLedgerEntry.objects.filter(provider=provider)
        earned = sum(float(x.amount) for x in ledger.filter(entry_type='earned'))
        paid_out = sum(float(x.amount) for x in ledger.filter(entry_type='payout'))

        return Response({
            'provider_id': provider.id,
            'total_jobs': total_jobs,
            'completed_jobs': completed_jobs,
            'cancelled_jobs': cancelled_jobs,
            'completion_rate': round((completed_jobs / total_jobs) * 100, 2) if total_jobs else 0,
            'avg_rating': avg_rating,
            'earned_total': round(earned, 2),
            'paid_out_total': round(paid_out, 2),
            'available_balance': round(earned - paid_out, 2),
        })

class StripeCheckoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        require_verified_email(request.user, message="Verify your email before payment.")
        invoice_id = request.data.get('invoice_id')
        success_url = request.data.get('success_url')
        cancel_url = request.data.get('cancel_url')
        
        if not invoice_id:
            return Response({'error': 'Invoice ID is required'}, status=400)

        try:
            invoice = Invoice.objects.select_related('job__request').get(id=invoice_id)
            if request.user.role == 'user' and invoice.job.request.user_id != request.user.id:
                return Response({'error': 'Forbidden'}, status=403)
            session = create_checkout_session(invoice_id, success_url, cancel_url)
            return Response({'checkout_url': session.url, 'session_id': session.id})
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class StripeConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        require_verified_email(request.user, message="Verify your email before payment confirmation.")
        invoice_id = request.data.get('invoice_id')
        session_id = request.data.get('session_id')
        if not invoice_id:
            return Response({'error': 'Invoice ID is required'}, status=400)

        try:
            invoice = Invoice.objects.get(id=invoice_id)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=404)

        # Owner or admin/provider only
        if request.user.role == 'user' and getattr(invoice.job.request, 'user_id', None) != request.user.id:
            return Response({'error': 'Forbidden'}, status=403)

        try:
            reconciled = confirm_invoice_payment(invoice, session_id=session_id)
            return Response(reconciled, status=200)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class StripeStatusView(APIView):
    """
    Debug endpoint to confirm which Stripe account/mode the backend is using.
    Does NOT expose any secret keys.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['admin', 'provider']:
            return Response({'error': 'Forbidden'}, status=403)
        try:
            ss = SystemSettings.get_settings()
            stripe_client = get_stripe_client()
            acct = stripe_client.Account.retrieve()
            return Response({
                'stripe_mode': ss.stripe_mode,
                'stripe_account_id': acct.get('id'),
                'stripe_account_email': acct.get('email'),
                'charges_enabled': bool(acct.get('charges_enabled')),
                'payouts_enabled': bool(acct.get('payouts_enabled')),
                'details_submitted': bool(acct.get('details_submitted')),
                'country': acct.get('country'),
                'type': acct.get('type'),
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)

@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        
        try:
            process_webhook_event(payload, sig_header)
            return Response({'status': 'success'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class VerificationQueueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        status_filter = request.query_params.get('status')
        qs = VerificationCase.objects.select_related('provider__user', 'reviewer').all()
        if status_filter:
            qs = qs.filter(status=status_filter)
        rows = []
        for case in qs[:200]:
            rows.append({
                'id': case.id,
                'provider_id': case.provider_id,
                'provider_name': case.provider.user.get_full_name() or case.provider.user.username,
                'status': case.status,
                'risk_score': case.risk_score,
                'confidence_score': case.confidence_score,
                'reviewer_id': case.reviewer_id,
                'reviewed_at': case.reviewed_at,
                'created_at': case.created_at,
            })
        return Response({'count': qs.count(), 'results': rows})


class VerificationQueueClaimView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        case = VerificationCase.objects.filter(id=case_id).first()
        if not case:
            return Response({'error': 'Case not found'}, status=404)
        action_name = str(request.data.get('action') or 'claim').strip().lower()
        if action_name == 'release':
            case.reviewer = None
        else:
            case.reviewer = request.user
            if case.status == 'SUBMITTED':
                case.status = 'REVIEW_REQUIRED'
        case.save(update_fields=['reviewer', 'status', 'updated_at'])
        return Response({'id': case.id, 'status': case.status, 'reviewer_id': case.reviewer_id})


class VerificationQueueDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        case = VerificationCase.objects.select_related('provider', 'bundle').filter(id=case_id).first()
        if not case:
            return Response({'error': 'Case not found'}, status=404)
        decision = str(request.data.get('decision') or '').strip().upper()
        allowed = {'APPROVED', 'REJECTED', 'CONDITIONAL'}
        if decision not in allowed:
            return Response({'error': 'decision must be APPROVED, REJECTED, or CONDITIONAL'}, status=400)
        reason = str(request.data.get('reason') or '').strip()
        case.status = decision
        case.reason = reason
        case.reviewer = request.user
        case.reviewed_at = timezone.now()
        case.save(update_fields=['status', 'reason', 'reviewer', 'reviewed_at', 'updated_at'])
        if decision == 'APPROVED':
            case.bundle.status = 'APPROVED'
            case.provider.verification_status = 'verified'
            case.provider.verified = True
            case.provider.verification_date = timezone.now()
        elif decision == 'REJECTED':
            case.bundle.status = 'REJECTED'
            case.provider.verification_status = 'rejected'
            case.provider.verified = False
        else:
            case.bundle.status = 'CONDITIONAL'
            case.provider.verification_status = 'under_review'
        case.bundle.save(update_fields=['status'])
        case.provider.save(update_fields=['verification_status', 'verified', 'verification_date', 'updated_at'])
        return Response({'id': case.id, 'status': case.status, 'reason': case.reason})


class NotificationFeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notif_qs = NotificationItem.objects.filter(user=request.user).order_by('-created_at')[:50]
        items = [{
            'id': row.id,
            'type': row.event_type,
            'title': row.title,
            'message': row.message,
            'payload': row.payload or {},
            'is_read': row.is_read,
            'created_at': row.created_at,
        } for row in notif_qs]

        # Inject unread chat messages as synthetic notification items
        chat_msgs = (
            Message.objects.filter(receiver=request.user, is_read=False)
            .select_related('sender', 'job', 'job__request')
            .order_by('-created_at')[:20]
        )
        for msg in chat_msgs:
            sender_name = msg.sender.get_full_name() or msg.sender.username if msg.sender else 'Unknown'
            job_title = ''
            if msg.job and hasattr(msg.job, 'request') and msg.job.request:
                job_title = msg.job.request.title or ''
            req_id = msg.job.request_id if msg.job else None
            items.append({
                'id': f'chat_{msg.id}',
                'type': 'chat_message',
                'title': f'Message from {sender_name}',
                'message': (msg.content or '')[:120],
                'payload': {
                    'job_id': msg.job_id,
                    'request_id': req_id,
                    'sender_id': msg.sender_id,
                    'job_title': job_title,
                },
                'is_read': False,
                'created_at': msg.created_at,
            })

        # Sort combined items by created_at descending
        items.sort(key=lambda x: x.get('created_at') or '', reverse=True)

        notif_unread = NotificationItem.objects.filter(user=request.user, is_read=False).count()
        chat_unread = chat_msgs.count()
        return Response({
            'items': items[:50],
            'unread_count': notif_unread + chat_unread,
            'chat_unread': chat_unread,
        })


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        item_id = request.data.get('id')
        if item_id:
            # Handle chat message read (synthetic id like 'chat_123')
            if str(item_id).startswith('chat_'):
                try:
                    msg_id = int(str(item_id).replace('chat_', ''))
                    Message.objects.filter(id=msg_id, receiver=request.user).update(is_read=True, read_at=timezone.now())
                except (ValueError, TypeError):
                    pass
            else:
                NotificationItem.objects.filter(id=item_id, user=request.user).update(is_read=True)
        else:
            NotificationItem.objects.filter(user=request.user, is_read=False).update(is_read=True)
        if bool(request.data.get('mark_chat_read')):
            Message.objects.filter(receiver=request.user, is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({'ok': True})
