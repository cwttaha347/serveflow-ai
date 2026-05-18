from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from api.models import EmailOTP, User


@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_THROTTLE_CLASSES": [
            "rest_framework.throttling.ScopedRateThrottle",
        ],
        "DEFAULT_THROTTLE_RATES": {
            "auth_login": "2/min",
            "auth_otp": "2/min",
            "auth_otp_email": "2/min",
            "auth_otp_verify": "2/min",
        },
    },
    AUTH_LOCKOUT_MAX_ATTEMPTS=3,
    AUTH_LOCKOUT_WINDOW_SECONDS=900,
    AUTH_LOCKOUT_DURATION_SECONDS=900,
    OTP_MAX_ATTEMPTS=5,
    ENABLE_EMAIL_OTP=False,
)
class AuthSecurityTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="secuser",
            email="sec@example.com",
            password="StrongPass123!",
            role="user",
        )

    def tearDown(self):
        cache.clear()

    def test_login_lockout_after_failed_attempts(self):
        for _ in range(2):
            response = self.client.post(
                "/api/auth/login/",
                {"username": "sec@example.com", "password": "wrong"},
                format="json",
            )
            self.assertEqual(response.status_code, 400)

        locked = self.client.post(
            "/api/auth/login/",
            {"username": "sec@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(locked.status_code, 429)
        self.assertIn("Too many failed attempts", locked.data["error"])

    @override_settings(OTP_RATE_LIMIT_PER_HOUR=1)
    @patch("api.tasks.dispatch_otp_email", return_value=True)
    def test_request_otp_hourly_limit_returns_429(self, mock_dispatch):
        mock_dispatch.return_value = True
        first = self.client.post(
            "/api/auth/request-otp/",
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(first.status_code, 200)
        second = self.client.post(
            "/api/auth/request-otp/",
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(second.status_code, 429)
        self.assertIn("Too many OTP requests", second.data["error"])

    @patch("api.tasks.dispatch_otp_email", return_value=True)
    def test_request_otp_invalidates_previous_unused(self, mock_dispatch):
        mock_dispatch.return_value = True
        self.client.post(
            "/api/auth/request-otp/",
            {"email": self.user.email},
            format="json",
        )
        self.client.post(
            "/api/auth/request-otp/",
            {"email": self.user.email},
            format="json",
        )
        unused = EmailOTP.objects.filter(user=self.user, is_used=False).count()
        self.assertEqual(unused, 1)

    def test_request_otp_generic_for_unknown_email(self):
        response = self.client.post(
            "/api/auth/request-otp/",
            {"email": "unknown@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("If an account exists", response.data["message"])

    def test_verify_otp_lockout_after_failures(self):
        from django.contrib.auth.hashers import make_password
        from django.utils import timezone
        from datetime import timedelta

        EmailOTP.objects.create(
            user=self.user,
            otp_hash=make_password("123456"),
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        for _ in range(3):
            self.client.post(
                "/api/auth/verify-otp/",
                {"email": self.user.email, "otp": "000000"},
                format="json",
            )
        locked = self.client.post(
            "/api/auth/verify-otp/",
            {"email": self.user.email, "otp": "000000"},
            format="json",
        )
        self.assertEqual(locked.status_code, 429)
