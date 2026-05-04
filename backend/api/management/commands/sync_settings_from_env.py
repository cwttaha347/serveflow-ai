from django.core.management.base import BaseCommand

from api.models import SystemSettings


class Command(BaseCommand):
    help = (
        "Apply environment variables to SystemSettings (row id=1). "
        "Without --force, only fills empty/default non-boolean fields and blank Gemini slots; "
        "use --force to overwrite existing values (including booleans from MAINTENANCE_MODE, etc.)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing DB values from env (required for boolean flags from env).",
        )

    def handle(self, *args, **options):
        force = options["force"]
        row, _ = SystemSettings.objects.get_or_create(id=1)
        changed = row.sync_from_env(force=force)
        if changed:
            self.stdout.write(self.style.SUCCESS("sync_from_env: database row was updated."))
        else:
            self.stdout.write("sync_from_env: no changes applied.")
