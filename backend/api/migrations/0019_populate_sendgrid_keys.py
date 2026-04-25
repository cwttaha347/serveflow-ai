from django.db import migrations

def populate_keys(apps, schema_editor):
    SystemSettings = apps.get_model('api', 'SystemSettings')
    settings, created = SystemSettings.objects.get_or_create(id=1)
    
    # User provided keys
    settings.smtp_user = 'REDACTED_TWILIO_API_KEY'
    settings.smtp_password = 'REDACTED_LEGACY_PASSWORD'
    settings.smtp_host = 'smtp.sendgrid.net'
    settings.smtp_port = 587
    settings.save()

def rollback_keys(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0018_alter_systemsettings_contact_email_and_more'),
    ]

    operations = [
        migrations.RunPython(populate_keys, rollback_keys),
    ]
