from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from api.models import User, Profile, NotificationItem


class RolloutValidationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='rollout_user',
            email='rollout@example.com',
            password='StrongPass123!',
            role='user',
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def test_profiles_me_auto_creates_profile(self):
        Profile.objects.filter(user=self.user).delete()
        resp = self.client.get('/api/profiles/me/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(Profile.objects.filter(user=self.user).exists())

    def test_notifications_feed_returns_items(self):
        NotificationItem.objects.create(user=self.user, message='Welcome', event_type='system')
        resp = self.client.get('/api/notifications/feed/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('items', resp.data)
        self.assertGreaterEqual(len(resp.data['items']), 1)
