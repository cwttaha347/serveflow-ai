from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_systemsettings_gemini_api_key_5'),
    ]

    operations = [
        migrations.AddField(
            model_name='request',
            name='group_id',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='multi_issue_split_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.CreateModel(
            name='NotificationItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(default='info', max_length=50)),
                ('title', models.CharField(blank=True, max_length=200)),
                ('message', models.TextField()),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notification_items', to='api.user')),
            ],
            options={
                'db_table': 'notification_items',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='VerificationCase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('SUBMITTED', 'Submitted'), ('PROCESSING', 'Processing'), ('AUTO_APPROVED', 'Auto Approved'), ('AUTO_REJECTED', 'Auto Rejected'), ('REVIEW_REQUIRED', 'Review Required'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('CONDITIONAL', 'Conditional')], default='SUBMITTED', max_length=20)),
                ('risk_score', models.FloatField(default=0)),
                ('confidence_score', models.FloatField(default=0)),
                ('reason', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('idempotency_key', models.CharField(blank=True, db_index=True, max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('bundle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='verification_cases', to='api.verificationbundle')),
                ('provider', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='verification_cases', to='api.provider')),
                ('reviewer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_verification_cases', to='api.user')),
            ],
            options={
                'db_table': 'verification_cases',
                'ordering': ['-created_at'],
            },
        ),
    ]
