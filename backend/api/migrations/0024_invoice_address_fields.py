from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0023_request_escrow_provider_stripe_connect'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='customer_address',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='provider_address',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='service_address',
            field=models.TextField(blank=True),
        ),
    ]
