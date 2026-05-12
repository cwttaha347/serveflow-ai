from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.utils import timezone
from django.test import override_settings
from rest_framework.test import APITestCase
from stripe._error import InvalidRequestError

from api.models import PasswordResetToken, Provider, User
from api.payments import get_or_create_connect_account


class ForgotPasswordFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='forgot_user',
            email='forgot@example.com',
            password='StrongPass123!',
            role='user',
        )

    @patch('api.emails.send_resilient_mail')
    def test_forgot_password_creates_hashed_token_for_allow_any_user(self, mock_send):
        mock_send.return_value = True
        response = self.client.post('/api/users/forgot_password/', {'email': self.user.email}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(PasswordResetToken.objects.filter(user=self.user).count(), 1)
        token = PasswordResetToken.objects.get(user=self.user)
        self.assertNotEqual(token.token_hash, '')
        self.assertGreater(token.expires_at, timezone.now())

    @patch('api.emails.send_resilient_mail')
    def test_forgot_password_throttles_rapid_reissue(self, mock_send):
        mock_send.return_value = True
        PasswordResetToken.objects.create(
            user=self.user,
            token_hash='a' * 64,
            expires_at=timezone.now() + timedelta(hours=1),
        )
        response = self.client.post('/api/users/forgot_password/', {'email': self.user.email}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(PasswordResetToken.objects.filter(user=self.user).count(), 1)
        mock_send.assert_not_called()

    @override_settings(FRONTEND_URL='')
    @patch('api.emails.send_resilient_mail')
    def test_forgot_password_keeps_generic_response_when_frontend_url_missing(self, mock_send):
        response = self.client.post('/api/users/forgot_password/', {'email': self.user.email}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('message', response.data)
        mock_send.assert_not_called()


class ConnectAccountRecoveryTests(APITestCase):
    def setUp(self):
        self.provider_user = User.objects.create_user(
            username='provider_user',
            email='provider@example.com',
            password='StrongPass123!',
            role='provider',
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            stripe_connect_account_id='acct_stale',
            stripe_connect_onboarding_complete=True,
        )

    @patch('api.payments.get_stripe_client')
    def test_get_or_create_connect_account_recovers_stale_saved_id(self, mock_client_factory):
        stripe_client = SimpleNamespace()
        stripe_client.Account = Mock()
        stripe_client.Account.retrieve.side_effect = InvalidRequestError(
            message='No such account',
            param='account',
            code='resource_missing',
        )
        stripe_client.Account.create.return_value = SimpleNamespace(id='acct_fresh')
        mock_client_factory.return_value = stripe_client

        account_id = get_or_create_connect_account(self.provider)
        self.provider.refresh_from_db()

        self.assertEqual(account_id, 'acct_fresh')
        self.assertEqual(self.provider.stripe_connect_account_id, 'acct_fresh')
        self.assertFalse(self.provider.stripe_connect_onboarding_complete)
