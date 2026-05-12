from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0022_fix_vehicle_category_typo"),
    ]

    operations = [
        migrations.AddField(
            model_name="provider",
            name="stripe_connect_account_id",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="provider",
            name="stripe_connect_onboarding_complete",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="request",
            name="escrow_checkout_session_id",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="request",
            name="escrow_payment_intent_id",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="request",
            name="escrow_status",
            field=models.CharField(
                choices=[
                    ("not_required", "Not required"),
                    ("awaiting_payment", "Awaiting payment"),
                    ("funded", "Funded"),
                    ("released", "Released"),
                ],
                default="not_required",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="request",
            name="escrow_transfer_id",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
