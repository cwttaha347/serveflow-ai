from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from api.models import Category, Job, Provider, Request, Review, User


class ReviewViewSetTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(
            name='Plumbing',
            pricing_model='hourly',
            base_price=80,
            icon='droplets',
            is_active=True,
        )
        self.seed_customer = User.objects.create_user(
            username='customer1',
            email='customer1@serveflow.ai',
            password='user12345',
            role='user',
        )
        self.new_user = User.objects.create_user(
            username='taha',
            email='codewithtaha.mentor@gmail.com',
            password='StrongPass123!',
            role='user',
        )
        self.provider_user = User.objects.create_user(
            username='pro_plumber',
            email='pro_plumber@serveflow.ai',
            password='user12345',
            role='provider',
        )
        self.provider = Provider.objects.create(user=self.provider_user, verified=True)
        self.provider.categories.add(self.category)

        seed_request = Request.objects.create(
            user=self.seed_customer,
            category=self.category,
            title='Seed request',
            description='Seeded job for QA',
            status='completed',
            address='1 Seed St',
            budget=100,
        )
        self.seed_job = Job.objects.create(
            request=seed_request,
            provider=self.provider,
            status='completed',
        )
        Review.objects.create(
            job=self.seed_job,
            rating=5,
            comment='Great service quality and communication.',
        )

    def _auth(self, user):
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_new_user_sees_no_reviews(self):
        self._auth(self.new_user)
        response = self.client.get('/api/reviews/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_seed_customer_sees_own_review(self):
        self._auth(self.seed_customer)
        response = self.client.get('/api/reviews/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['comment'], 'Great service quality and communication.')

    def test_provider_sees_reviews_for_their_jobs(self):
        self._auth(self.provider_user)
        response = self.client.get('/api/reviews/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['job'], self.seed_job.id)
