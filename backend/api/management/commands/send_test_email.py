from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api.models import EmailLog, SystemSettings
from api.emails import merge_smtp_config
from api.tasks import send_otp_email


class Command(BaseCommand):
    help = (
        "Send a test OTP-style email using the same delivery path as verification OTPs. "
        "Checks SystemSettings + env SMTP settings. Inspect api EmailLog on failure."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "recipient",
            nargs="?",
            default="",
            help="Recipient email address (required unless --show-config).",
        )
        parser.add_argument(
            "--show-config",
            action="store_true",
            help="Print merged SMTP/from settings without sending.",
        )

    def handle(self, *args, **options):
        if options["show_config"]:
            self._print_config()
            return

        recipient = (options["recipient"] or "").strip()
        if not recipient or "@" not in recipient:
            raise CommandError("Provide a recipient: python manage.py send_test_email you@example.com")

        if not getattr(settings, "ENABLE_EMAIL_OTP", True):
            self.stdout.write(
                self.style.WARNING("ENABLE_EMAIL_OTP is False — enabling send for this test only.")
            )

        self.stdout.write(f"Sending test OTP email to {recipient} …")
        send_otp_email.apply(args=[recipient, "999999"])

        log = (
            EmailLog.objects.filter(recipient_email=recipient)
            .order_by("-sent_at")
            .first()
        )
        if log and log.success:
            self.stdout.write(self.style.SUCCESS(f"Delivered (see EmailLog id={log.id})."))
        elif log:
            self.stdout.write(
                self.style.ERROR(f"Send failed: {log.error_message or 'unknown'} (EmailLog id={log.id})")
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "No EmailLog row found — check server logs. "
                    "If using console backend, mail prints to the Django process stdout."
                )
            )

    def _print_config(self):
        row = SystemSettings.get_settings()
        host, port, user, _password, use_tls, from_email = merge_smtp_config(row)
        masked_user = user[:4] + "…" if user and len(user) > 4 else (user or "(empty)")
        self.stdout.write(f"  smtp_host:     {host or '(empty)'}")
        self.stdout.write(f"  smtp_port:     {port}")
        self.stdout.write(f"  smtp_user:     {masked_user}")
        self.stdout.write(f"  smtp_use_tls:  {use_tls}")
        self.stdout.write(f"  from_email:    {from_email or '(empty)'}")
