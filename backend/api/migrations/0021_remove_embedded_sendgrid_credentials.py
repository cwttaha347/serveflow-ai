from django.db import migrations

# Values previously inserted by migration 0019 (committed secrets — must come from env only).
_LEGACY_SMTP_USER = "REDACTED_TWILIO_API_KEY"
_LEGACY_SMTP_PASSWORD = "REDACTED_LEGACY_PASSWORD"


def clear_legacy_sendgrid(apps, schema_editor):
    SystemSettings = apps.get_model("api", "SystemSettings")
    row = SystemSettings.objects.filter(id=1).first()
    if not row:
        return
    if row.smtp_user == _LEGACY_SMTP_USER and row.smtp_password == _LEGACY_SMTP_PASSWORD:
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
