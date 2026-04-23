from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import User, Profile


class Command(BaseCommand):
    help = "Create missing Profile rows for existing users."

    def handle(self, *args, **options):
        missing_users = User.objects.filter(profile__isnull=True).only('id')
        created = 0
        with transaction.atomic():
            for user in missing_users.iterator():
                Profile.objects.get_or_create(user=user)
                created += 1
        self.stdout.write(self.style.SUCCESS(f"Created {created} missing profile rows."))
