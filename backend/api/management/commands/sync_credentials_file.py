from django.core.management.base import BaseCommand

from api.credentials_loader import (
    apply_credentials_to_settings,
    parse_credentials_file,
    resolve_credentials_path,
)
from api.models import SystemSettings


class Command(BaseCommand):
    help = (
        "Load credentials.txt into SystemSettings (id=1). "
        "By default only fills empty fields so Admin UI edits persist. "
        "Use --force to overwrite SMTP/from_email from the file (recommended after updating credentials.txt)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing DB values from credentials file.",
        )

    def handle(self, *args, **options):
        path = resolve_credentials_path()
        if not path:
            self.stdout.write(
                self.style.WARNING(
                    "sync_credentials_file: no credentials.txt found "
                    "(set CREDENTIALS_FILE or place file at repo root)."
                )
            )
            return

        parsed = parse_credentials_file(path)
        if not parsed:
            self.stdout.write(
                self.style.WARNING(f"sync_credentials_file: no values parsed from {path}")
            )
            return

        row, _ = SystemSettings.objects.get_or_create(id=1)
        fill_empty_only = not options["force"]
        updated = apply_credentials_to_settings(
            row, parsed, fill_empty_only=fill_empty_only
        )
        if updated:
            row.save(update_fields=updated)
            self.stdout.write(
                self.style.SUCCESS(
                    f"sync_credentials_file: updated {len(updated)} field(s) from {path.name}."
                )
            )
        else:
            self.stdout.write("sync_credentials_file: no changes applied.")
