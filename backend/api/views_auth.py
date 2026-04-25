import secrets
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.hashers import make_password, check_password
import hashlib
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from django.conf import settings
from .models import User, EmailOTP, EmailVerificationToken
from .tasks import send_otp_email

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

@method_decorator(csrf_exempt, name='dispatch')
class RequestOTPView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_otp"

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        generic = {'message': 'If an account exists, an OTP has been sent.'}
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(generic, status=status.HTTP_200_OK)

        # Rate limiting: Configurable via settings.py
        one_hour_ago = timezone.now() - timedelta(hours=1)
        recent_otps = EmailOTP.objects.filter(user=user, created_at__gte=one_hour_ago).count()
        limit = getattr(settings, 'OTP_RATE_LIMIT_PER_HOUR', 3)
        if recent_otps >= limit:
            return Response({
                'error': f'Too many OTP requests. Max {limit} per hour. Please try again later.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Generate 6-digit OTP
        otp = str(secrets.randbelow(1_000_000)).zfill(6)
        
        # Hash and Store
        otp_hash = make_password(otp)
        expiry_seconds = getattr(settings, 'OTP_EXPIRY_SECONDS', 600)
        expires_at = timezone.now() + timedelta(seconds=expiry_seconds)
        
        EmailOTP.objects.create(
            user=user,
            otp_hash=otp_hash,
            expires_at=expires_at,
            ip_address=request.META.get('REMOTE_ADDR')
        )

        # Send Email (async task)
        print(f"\n[SECURITY] OTP for {email} is: {otp}\n")
        send_otp_email.delay(email, otp)

        response_data = {
            'message': generic['message'],
            'expires_in_seconds': expiry_seconds
        }

        return Response(response_data)

class VerifyOTPView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_otp_verify"

    def post(self, request):
        email = request.data.get('email')
        otp_input = request.data.get('otp')

        if not email or not otp_input:
            return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            # Get the latest unused OTP
            otp_obj = EmailOTP.objects.filter(user=user, is_used=False).latest('created_at')
        except (User.DoesNotExist, EmailOTP.DoesNotExist):
            return Response({'error': 'Invalid request or OTP expired'}, status=status.HTTP_400_BAD_REQUEST)

        # Check expiry
        if timezone.now() > otp_obj.expires_at:
            return Response({'error': 'OTP has expired'}, status=status.HTTP_410_GONE)

        # Check attempts
        if otp_obj.attempts >= getattr(settings, 'OTP_MAX_ATTEMPTS', 5):
            otp_obj.is_used = True # Invalidate
            otp_obj.save()
            return Response({'error': 'Too many failed attempts. Request a new OTP.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Verify Hash
        if check_password(otp_input, otp_obj.otp_hash):
            otp_obj.is_used = True
            otp_obj.save()
            
            # Verify user email
            user.is_email_verified = True
            user.save()
            
            # In a real JWT app, you'd issue tokens here. 
            # For this demo stack, we return success and the frontend can handle the session.
            return Response({
                'status': 'verified',
                'message': 'Email verified successfully'
            })
        else:
            otp_obj.attempts += 1
            otp_obj.save()
            remaining = getattr(settings, 'OTP_MAX_ATTEMPTS', 5) - otp_obj.attempts
            return Response({
                'error': f'Incorrect OTP. {remaining} attempts remaining.'
            }, status=status.HTTP_401_UNAUTHORIZED)


class RequestEmailVerificationLinkView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
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
        from django.core.mail import get_connection
        from .models import SystemSettings
        import requests
        
        sys_settings = SystemSettings.get_settings()
        
        is_sendgrid = (
            sys_settings.smtp_user == 'apikey' or 
            'sendgrid' in sys_settings.smtp_host.lower() or 
            sys_settings.smtp_password.startswith('SG.')
        )
        
        if is_sendgrid and sys_settings.smtp_password:
            url = "https://api.sendgrid.com/v3/mail/send"
            headers = {
                "Authorization": f"Bearer {sys_settings.smtp_password}",
                "Content-Type": "application/json"
            }
            data = {
                "personalizations": [{"to": [{"email": request.user.email}]}],
                "from": {"email": settings.DEFAULT_FROM_EMAIL or 'noreply@serveflow.ai'},
                "subject": 'Verify your ServeFlow email',
                "content": [
                    {"type": "text/plain", "value": f'Click this link to verify your email: {verify_link}'}
                ]
            }
            res = requests.post(url, json=data, headers=headers, timeout=10)
            res.raise_for_status()
        else:
            connection = None
            if sys_settings.smtp_user and sys_settings.smtp_password:
                connection = get_connection(
                    backend='django.core.mail.backends.smtp.EmailBackend',
                    host=sys_settings.smtp_host,
                    port=sys_settings.smtp_port,
                    username=sys_settings.smtp_user,
                    password=sys_settings.smtp_password,
                    use_tls=sys_settings.smtp_use_tls,
                    timeout=5
                )

            send_mail(
                'Verify your ServeFlow email',
                f'Click this link to verify your email: {verify_link}',
                settings.DEFAULT_FROM_EMAIL or 'noreply@serveflow.ai',
                [request.user.email],
                fail_silently=True,
                connection=connection
            )
        return Response({'message': 'Verification link sent.'}, status=status.HTTP_200_OK)


class VerifyEmailLinkView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_otp_verify"

    def post(self, request):
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
            return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)

        user = token_obj.user
        user.is_email_verified = True
        user.save(update_fields=['is_email_verified'])
        token_obj.is_used = True
        token_obj.used_at = timezone.now()
        token_obj.save(update_fields=['is_used', 'used_at'])
        return Response({'status': 'verified', 'message': 'Email verified successfully'})
