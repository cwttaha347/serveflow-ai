from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0013_provider_skills_onboarding"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="gemini_api_key_5",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
