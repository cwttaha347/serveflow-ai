import logging
import secrets
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.hashers import make_password, check_password
import hashlib
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.conf import settings
from .models import User, EmailOTP, EmailVerificationToken
from .tasks import dispatch_otp_email
from .emails import send_email_verification
from .auth_security import (
    AuthIPThrottle,
    AuthEmailThrottle,
    check_lockouts,
    clear_auth_failures,
    email_fingerprint,
    get_client_ip,
    log_auth_failure,
    log_auth_success,
    normalize_email,
    record_auth_failure,
    reject_oversized_body,
    validate_auth_email,
)

from django.utils.decorators import method_decorator

logger = logging.getLogger(__name__)
from django.views.decorators.csrf import csrf_exempt

GENERIC_OTP_MESSAGE = "If an account exists, an OTP has been sent."


@method_decorator(csrf_exempt, name='dispatch')
class RequestOTPView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [AuthIPThrottle, AuthEmailThrottle]
    throttle_scope = "auth_otp"
    email_throttle_scope = "auth_otp_email"

    def post(self, request):
        oversized = reject_oversized_body(request)
        if oversized:
            return oversized

        email = normalize_email(request.data.get('email'))
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        email_error = validate_auth_email(email)
        if email_error:
            return Response({'error': email_error}, status=status.HTTP_400_BAD_REQUEST)

        email_fp = email_fingerprint(email)
        ip = get_client_ip(request)
        locked = check_lockouts(request, "otp_request", (ip, email_fp))
        if locked:
            return locked

        generic = {'message': GENERIC_OTP_MESSAGE}
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            log_auth_success("otp_request_noop", request, email_fp=email_fp)
            return Response(generic, status=status.HTTP_200_OK)

        one_hour_ago = timezone.now() - timedelta(hours=1)
        recent_otps = EmailOTP.objects.filter(user=user, created_at__gte=one_hour_ago).count()
        limit = getattr(settings, 'OTP_RATE_LIMIT_PER_HOUR', 3)
        if recent_otps >= limit:
            log_auth_failure(
                "otp_request",
                request,
                reason="hourly_limit",
                email_fp=email_fp,
                user_id=user.id,
            )
            return Response({
                'error': 'Too many OTP requests. Please try again later.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        otp = str(secrets.randbelow(1_000_000)).zfill(6)
        otp_hash = make_password(otp)
        expiry_seconds = getattr(settings, 'OTP_EXPIRY_SECONDS', 600)
        expires_at = timezone.now() + timedelta(seconds=expiry_seconds)

        EmailOTP.objects.filter(user=user, is_used=False).update(is_used=True)

        EmailOTP.objects.create(
            user=user,
            otp_hash=otp_hash,
            expires_at=expires_at,
            ip_address=ip,
        )

        delivery_hint = None
        sent_inline = False
        try:
            sent_inline = dispatch_otp_email(email, otp)
        except Exception as e:
            logger.error("Failed to send OTP email for %s: %s", email_fp, e)
            delivery_hint = str(e)

        log_auth_success("otp_request", request, email_fp=email_fp, user_id=user.id)

        response_data = {
            'message': generic['message'],
            'expires_in_seconds': expiry_seconds,
            'email_sent': sent_inline,
        }
        if settings.DEBUG:
            from .models import EmailLog
            last_log = (
                EmailLog.objects.filter(recipient_email=email)
                .order_by("-sent_at")
                .first()
            )
            if last_log:
                response_data['email_delivered'] = last_log.success
                if not last_log.success:
                    delivery_hint = last_log.error_message or delivery_hint
            elif not sent_inline:
                delivery_hint = (
                    delivery_hint
                    or "OTP queued for background delivery — start a Celery worker or set "
                    "CELERY_TASK_ALWAYS_EAGER=true."
                )
            response_data['delivery_hint'] = (
                delivery_hint
                or 'If the email does not arrive, check spam and run: '
                'python manage.py send_test_email <your@email> (Admin → Email logs).'
            )

        return Response(response_data)


class VerifyOTPView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [AuthIPThrottle, AuthEmailThrottle]
    throttle_scope = "auth_otp_verify"
    email_throttle_scope = "auth_otp_verify"

    def post(self, request):
        oversized = reject_oversized_body(request)
        if oversized:
            return oversized

        email = normalize_email(request.data.get('email'))
        otp_input = str(request.data.get('otp') or '').strip()

        if not email or not otp_input:
            return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)

        email_error = validate_auth_email(email)
        if email_error:
            return Response({'error': email_error}, status=status.HTTP_400_BAD_REQUEST)

        email_fp = email_fingerprint(email)
        ip = get_client_ip(request)
        locked = check_lockouts(request, "otp_verify", (ip, email_fp))
        if locked:
            return locked

        try:
            user = User.objects.get(email=email)
            otp_obj = EmailOTP.objects.filter(user=user, is_used=False).latest('created_at')
        except (User.DoesNotExist, EmailOTP.DoesNotExist):
            record_auth_failure("otp_verify", ip)
            record_auth_failure("otp_verify", email_fp)
            log_auth_failure("otp_verify", request, reason="invalid_or_missing", email_fp=email_fp)
            return Response({'error': 'Invalid request or OTP expired'}, status=status.HTTP_400_BAD_REQUEST)

        if timezone.now() > otp_obj.expires_at:
            otp_obj.is_used = True
            otp_obj.save(update_fields=['is_used'])
            log_auth_failure("otp_verify", request, reason="expired", email_fp=email_fp, user_id=user.id)
            return Response({'error': 'OTP has expired'}, status=status.HTTP_410_GONE)

        max_attempts = getattr(settings, 'OTP_MAX_ATTEMPTS', 5)
        if otp_obj.attempts >= max_attempts:
            otp_obj.is_used = True
            otp_obj.save(update_fields=['is_used'])
            record_auth_failure("otp_verify", ip)
            record_auth_failure("otp_verify", email_fp)
            log_auth_failure("otp_verify", request, reason="otp_attempts_exhausted", email_fp=email_fp, user_id=user.id)
            return Response(
                {'error': 'Too many failed attempts. Request a new OTP.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if check_password(otp_input, otp_obj.otp_hash):
            otp_obj.is_used = True
            otp_obj.save(update_fields=['is_used'])
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified'])
            clear_auth_failures("otp_verify", ip, email_fp)
            log_auth_success("otp_verify", request, email_fp=email_fp, user_id=user.id)
            return Response({
                'status': 'verified',
                'message': 'Email verified successfully'
            })

        otp_obj.attempts += 1
        otp_obj.save(update_fields=['attempts'])
        now_locked_ip = record_auth_failure("otp_verify", ip)
        now_locked_email = record_auth_failure("otp_verify", email_fp)
        log_auth_failure("otp_verify", request, reason="incorrect_otp", email_fp=email_fp, user_id=user.id)

        if now_locked_ip or now_locked_email or otp_obj.attempts >= max_attempts:
            if otp_obj.attempts >= max_attempts:
                otp_obj.is_used = True
                otp_obj.save(update_fields=['is_used'])
            return Response(
                {'error': 'Too many failed attempts. Request a new OTP.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        remaining = max_attempts - otp_obj.attempts
        return Response(
            {'error': f'Incorrect OTP. {remaining} attempts remaining.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )


class RequestEmailVerificationLinkView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AuthIPThrottle]
    throttle_scope = "auth_otp"

    def post(self, request):
        if request.user.is_email_verified:
            return Response({'message': 'Email already verified.'}, status=status.HTTP_200_OK)

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = timezone.now() + timedelta(hours=24)
        EmailVerificationToken.objects.create(
            user=request.user,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        verify_link = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={raw_token}"
        user_name = request.user.get_full_name() or request.user.username
        send_email_verification(request.user.email, verify_link, user_name=user_name)
        return Response({'message': 'Verification link sent.'}, status=status.HTTP_200_OK)


class VerifyEmailLinkView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [AuthIPThrottle]
    throttle_scope = "auth_otp_verify"

    def post(self, request):
        oversized = reject_oversized_body(request)
        if oversized:
            return oversized

        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        token_obj = EmailVerificationToken.objects.select_related('user').filter(
            token_hash=token_hash,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).first()
        if not token_obj:
            log_auth_failure("email_link_verify", request, reason="invalid_token")
            return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)

        user = token_obj.user
        user.is_email_verified = True
        user.save(update_fields=['is_email_verified'])
        token_obj.is_used = True
        token_obj.used_at = timezone.now()
        token_obj.save(update_fields=['is_used', 'used_at'])
        log_auth_success("email_link_verify", request, user_id=user.id)
        return Response({'status': 'verified', 'message': 'Email verified successfully'})
