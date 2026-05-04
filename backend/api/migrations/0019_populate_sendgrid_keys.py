from django.db import migrations


def noop(apps, schema_editor):
    """Legacy migration previously embedded credentials; keys must come from env or admin UI."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0018_alter_systemsettings_contact_email_and_more"),
    ]

    operations = [
        migrations.RunPython(noop, noop),
    ]
