import hashlib

from django.db import migrations

# SHA256 of legacy values that were mistakenly committed in migration 0019 (compare only; no secrets in repo).
_LEGACY_SMTP_USER_SHA256 = "bd72b81507c67b0acfc7c0768626755a73a139ab782d186080d4d26e6b4468d2"
_LEGACY_SMTP_PASSWORD_SHA256 = "b7208cdc513eca296dc4c47d1b7b1a396fcd356412c293d51212f34983134124"


def clear_legacy_sendgrid(apps, schema_editor):
    SystemSettings = apps.get_model("api", "SystemSettings")
    row = SystemSettings.objects.filter(id=1).first()
    if not row:
        return
    uh = hashlib.sha256((row.smtp_user or "").encode("utf-8")).hexdigest()
    ph = hashlib.sha256((row.smtp_password or "").encode("utf-8")).hexdigest()
    if uh == _LEGACY_SMTP_USER_SHA256 and ph == _LEGACY_SMTP_PASSWORD_SHA256:
        row.smtp_user = ""
        row.smtp_password = ""
        row.save(update_fields=["smtp_user", "smtp_password"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0020_systemsettings_from_email"),
    ]

    operations = [
        migrations.RunPython(clear_legacy_sendgrid, noop),
    ]
