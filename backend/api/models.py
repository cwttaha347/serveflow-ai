from django.contrib.auth.models import AbstractUser, UserManager as BaseUserManager
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
import os
import re

class UserManager(BaseUserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('role', 'admin')  # Set admin role for superusers
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return super().create_superuser(username, email, password, **extra_fields)

class User(AbstractUser):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('provider', 'Provider'),
        ('worker', 'Worker'),
        ('admin', 'Admin'),
    ]
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    phone = models.CharField(max_length=20, blank=True)
    is_email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UserManager()

    class Meta:
        db_table = 'users'

class EmailOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp_hash = models.CharField(max_length=128)      # Hashed OTP only
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)
    ip_address = models.GenericIPAddressField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_otps'
        ordering = ['-created_at']


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token_hash = models.CharField(max_length=128, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'password_reset_tokens'
        ordering = ['-created_at']


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_verification_tokens')
    token_hash = models.CharField(max_length=128, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'email_verification_tokens'
        ordering = ['-created_at']

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    photo = models.ImageField(upload_to='profiles/', null=True, blank=True)
    bio = models.TextField(blank=True)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    certifications = models.JSONField(default=list, blank=True)
    
    class Meta:
        db_table = 'profiles'

class Category(models.Model):
    PRICING_MODELS = [
        ('fixed', 'Fixed Price'),
        ('hourly', 'Hourly Rate'),
        ('quote', 'Quote Based'),
    ]
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pricing_model = models.CharField(max_length=10, choices=PRICING_MODELS, default='fixed')
    icon = models.CharField(max_length=50, blank=True)
    image = models.ImageField(upload_to='categories/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'Categories'

class RateCard(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='rate_cards')
    min_severity = models.IntegerField(default=1) # 1-10
    max_severity = models.IntegerField(default=10)
    base_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        db_table = 'rate_cards'

class PromptVersion(models.Model):
    name = models.CharField(max_length=100) # e.g. "request_analysis"
    version = models.CharField(max_length=20) # e.g. "2.0.0"
    prompt_text = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'prompt_versions'
        unique_together = ['name', 'version']

class Provider(models.Model):
    VERIFICATION_STATUSES = [
        ('pending', 'Pending'),
        ('under_review', 'Under Review'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='provider_profile')
    bio = models.TextField(blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    completed_jobs = models.PositiveIntegerField(default=0)
    total_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    verified = models.BooleanField(default=False)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUSES, default='pending')
    verification_date = models.DateTimeField(null=True, blank=True)
    availability_status = models.CharField(max_length=20, default='available')
    categories = models.ManyToManyField(Category, related_name='providers')
    skills = models.JSONField(default=list, blank=True)
    onboarding_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'providers'


class Worker(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('on_job', 'On Job'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='worker_profile')
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='workers')
    display_name = models.CharField(max_length=120, blank=True)
    is_verified = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workers'

class PortfolioImage(models.Model):
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='portfolio_images')
    image = models.ImageField(upload_to='verif/portfolio/')
    caption = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class VerificationBundle(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('APPROVED', 'Approved'),
        ('CONDITIONAL', 'Conditional'),
        ('REJECTED', 'Rejected'),
        ('UNDER_REVIEW', 'Under Review'),
    ]
    provider = models.OneToOneField(Provider, on_delete=models.CASCADE, related_name='verification_bundle')
    id_front = models.ImageField(upload_to='verif/ids/')
    id_back = models.ImageField(upload_to='verif/ids/')
    selfie_with_id = models.ImageField(upload_to='verif/selfies/')
    certificate = models.ImageField(upload_to='verif/certs/', null=True, blank=True)
    portfolio_imgs = models.ManyToManyField(PortfolioImage, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    class Meta:
        db_table = 'verification_bundles'

class VerificationAuditLog(models.Model):
    bundle = models.ForeignKey(VerificationBundle, on_delete=models.CASCADE, related_name='audit_logs')
    trust_score = models.FloatField()
    id_score = models.FloatField()
    liveness_score = models.FloatField()
    cert_score = models.FloatField(null=True)
    portfolio_score = models.FloatField(null=True)
    decision = models.CharField(max_length=20)  # APPROVED / CONDITIONAL / REJECTED
    gemini_raw = models.JSONField()               # Full AI response stored for audit
    decided_at = models.DateTimeField(auto_now_add=True)
    is_human_review = models.BooleanField(default=False)

    class Meta:
        db_table = 'verification_audit_logs'


class VerificationCase(models.Model):
    STATUS_CHOICES = [
        ('SUBMITTED', 'Submitted'),
        ('PROCESSING', 'Processing'),
        ('AUTO_APPROVED', 'Auto Approved'),
        ('AUTO_REJECTED', 'Auto Rejected'),
        ('REVIEW_REQUIRED', 'Review Required'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CONDITIONAL', 'Conditional'),
    ]
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='verification_cases')
    bundle = models.ForeignKey(VerificationBundle, on_delete=models.CASCADE, related_name='verification_cases')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SUBMITTED')
    risk_score = models.FloatField(default=0)
    confidence_score = models.FloatField(default=0)
    reason = models.TextField(blank=True)
    reviewer = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_verification_cases')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=64, db_index=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'verification_cases'
        ordering = ['-created_at']

class RequestImage(models.Model):
    image = models.ImageField(upload_to='requests/')
    created_at = models.DateTimeField(auto_now_add=True)

class ServiceRequest(models.Model):
    STATUS_CHOICES = [
        ('INGESTING', 'Ingesting'),
        ('OPEN', 'Open'),
        ('BIDDING', 'Bidding'),
        ('AWARDED', 'Awarded'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='service_requests')
    raw_description = models.TextField()
    images = models.ManyToManyField(RequestImage, blank=True)
    
    # AI-generated fields
    ai_title = models.CharField(max_length=200, blank=True)
    ai_category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL)
    severity_score = models.IntegerField(null=True)   # 1–10
    complexity = models.CharField(max_length=20, blank=True)  # LOW / MEDIUM / HIGH
    urgency = models.CharField(max_length=20, blank=True)  # STANDARD / IMMEDIATE
    est_price_min = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    est_price_max = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    est_duration_hrs = models.FloatField(null=True)
    ai_analysis_raw = models.JSONField(default=dict)   # full Gemini response
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='INGESTING')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'service_requests'
        ordering = ['-created_at']

class ProviderMatch(models.Model):
    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name='matches')
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='request_matches')
    total_score = models.FloatField()
    affinity_score = models.FloatField()
    proximity_score = models.FloatField()
    reputation_score = models.FloatField()
    pulse_bonus = models.FloatField()
    distance_km = models.FloatField()
    notified_at = models.DateTimeField(null=True, blank=True)
    seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'provider_matches'
        unique_together = ['request', 'provider']

class Request(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('open_for_bids', 'Open for Bids'),
        ('analyzing', 'Analyzing'),
        ('matched', 'Matched'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='requests')
    group_id = models.CharField(max_length=64, blank=True, db_index=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    address = models.TextField()
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    ai_summary = models.JSONField(default=dict, blank=True)
    images = models.JSONField(default=list, blank=True)
    preferred_date = models.DateTimeField(null=True, blank=True)
    budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'requests'
        ordering = ['-created_at']


class NotificationItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notification_items')
    event_type = models.CharField(max_length=50, default='info')
    title = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notification_items'
        ordering = ['-created_at']

class Job(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('started', 'Started'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name='jobs')
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='jobs')
    assigned_worker = models.ForeignKey('Worker', on_delete=models.SET_NULL, null=True, blank=True, related_name='jobs')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    match_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    match_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    provider_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'jobs'
        ordering = ['-created_at']


class JobStatusHistory(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='job_status_changes')
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'job_status_history'
        ordering = ['-created_at']


class WorkerLocationPing(models.Model):
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name='location_pings')
    job = models.ForeignKey(Job, on_delete=models.SET_NULL, null=True, blank=True, related_name='location_pings')
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy_m = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    source = models.CharField(max_length=32, default='mobile')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'worker_location_pings'
        ordering = ['-created_at']

class Invoice(models.Model):
    job = models.OneToOneField(Job, on_delete=models.CASCADE, related_name='invoice')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_method = models.CharField(max_length=50, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'invoices'


class RevenueSplitRule(models.Model):
    SCOPE_CHOICES = [
        ('global', 'Global'),
        ('provider', 'Provider'),
        ('category', 'Category'),
    ]
    name = models.CharField(max_length=120)
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='global')
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, null=True, blank=True, related_name='split_rules')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True, blank=True, related_name='split_rules')
    platform_percent = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    provider_percent = models.DecimalField(max_digits=5, decimal_places=2, default=90)
    referral_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'revenue_split_rules'


class ProviderLedgerEntry(models.Model):
    ENTRY_TYPES = [
        ('earned', 'Earned'),
        ('hold', 'Hold'),
        ('release', 'Release'),
        ('payout', 'Payout'),
        ('refund_reversal', 'Refund Reversal'),
    ]
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='ledger_entries')
    job = models.ForeignKey(Job, on_delete=models.SET_NULL, null=True, blank=True, related_name='ledger_entries')
    invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='ledger_entries')
    entry_type = models.CharField(max_length=32, choices=ENTRY_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=8, default='USD')
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_ledger_entries'
        ordering = ['-created_at']


class ProviderPayout(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='payouts')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=8, default='USD')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reference = models.CharField(max_length=120, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_payouts'
        ordering = ['-created_at']

class Review(models.Model):
    job = models.OneToOneField(Job, on_delete=models.CASCADE, related_name='review')
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'reviews'

class Dispute(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('investigating', 'Investigating'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='disputes')
    raised_by = models.ForeignKey(User, on_delete=models.CASCADE)
    reason = models.TextField()
    ai_summary = models.JSONField(default=dict, blank=True)
    admin_decision = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'disputes'

class EmailLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=200)
    content = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    
    class Meta:
        db_table = 'email_logs'
        ordering = ['-sent_at']

class SystemSettings(models.Model):
    # General
    platform_name = models.CharField(max_length=100, default='ServeFlow AI', blank=True)
    contact_email = models.EmailField(default='support@serveflow.ai', blank=True)
    from_email = models.CharField(max_length=255, default='ServeFlow AI <noreply@serveflow.ai>', blank=True)
    currency_symbol = models.CharField(max_length=10, default='$', blank=True)
    
    # Financial
    commission_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    min_payout_amount = models.DecimalField(max_digits=10, decimal_places=2, default=50.00)
    
    # SMTP Configuration (Live)
    smtp_host = models.CharField(max_length=255, default='smtp.gmail.com', blank=True)
    smtp_port = models.IntegerField(default=587, null=True, blank=True)
    smtp_user = models.CharField(max_length=255, blank=True)
    smtp_password = models.CharField(max_length=255, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    
    # Feature Flags
    maintenance_mode = models.BooleanField(default=False)
    enable_ai_analysis = models.BooleanField(default=True)
    enable_bidding_system = models.BooleanField(default=True)
    require_provider_verification = models.BooleanField(default=True)
    multi_issue_split_enabled = models.BooleanField(default=True)
    
    # AI Configuration (Multi-Key Rotation)
    gemini_api_key_1 = models.CharField(max_length=255, blank=True)
    gemini_api_key_2 = models.CharField(max_length=255, blank=True)
    gemini_api_key_3 = models.CharField(max_length=255, blank=True)
    gemini_api_key_4 = models.CharField(max_length=255, blank=True)
    gemini_api_key_5 = models.CharField(max_length=255, blank=True)
    
    # Stripe Configuration
    stripe_public_key = models.CharField(max_length=255, blank=True)
    stripe_secret_key = models.CharField(max_length=255, blank=True)
    stripe_webhook_secret = models.CharField(max_length=255, blank=True)
    stripe_mode = models.CharField(max_length=10, choices=[('test', 'Test'), ('live', 'Live')], default='test')
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_settings'
        verbose_name_plural = 'System Settings'
        
    @classmethod
    def get_settings(cls):
        settings, created = cls.objects.get_or_create(id=1)
        force_env = (
            os.environ.get("SYNC_SETTINGS_FROM_ENV_FORCE", "False").lower() == "true"
            or os.environ.get("HF_SYNC_SETTINGS_FROM_ENV", "False").lower() == "true"
        )
        settings.sync_from_env(force=force_env)
        return settings

    def sync_from_env(self, force: bool = False):
        """
        Synchronizes system settings from environment variables.
        If force=False, it only populates fields that are currently blank or set to their default values.
        """
        mapping = {
            # ENV_VAR_NAME: (field_name, type_converter, alternate_env_keys)
            'PLATFORM_NAME': ('platform_name', str, []),
            'CONTACT_EMAIL': ('contact_email', str, []),
            'DEFAULT_FROM_EMAIL': ('from_email', str, ['FROM_EMAIL']),
            'CURRENCY_SYMBOL': ('currency_symbol', str, []),
            'COMMISSION_PERCENTAGE': ('commission_percentage', float, []),
            'TAX_PERCENTAGE': ('tax_percentage', float, []),
            'MIN_PAYOUT_AMOUNT': ('min_payout_amount', float, []),
            'SMTP_HOST': ('smtp_host', str, ['EMAIL_HOST']),
            'SMTP_PORT': ('smtp_port', int, ['EMAIL_PORT']),
            # Do not map SENDGRID_API_KEY to smtp_user (use apikey + SG.* password; see below).
            'SMTP_USER': ('smtp_user', str, ['EMAIL_HOST_USER']),
            'SMTP_PASSWORD': ('smtp_password', str, ['EMAIL_HOST_PASSWORD', 'SENDGRID_API_KEY']),
            'SMTP_USE_TLS': ('smtp_use_tls', lambda x: str(x).lower() == 'true', ['EMAIL_USE_TLS']),
            'MAINTENANCE_MODE': ('maintenance_mode', lambda x: str(x).lower() == 'true', []),
            'ENABLE_AI_ANALYSIS': ('enable_ai_analysis', lambda x: str(x).lower() == 'true', []),
            'ENABLE_BIDDING_SYSTEM': ('enable_bidding_system', lambda x: str(x).lower() == 'true', []),
            'REQUIRE_PROVIDER_VERIFICATION': ('require_provider_verification', lambda x: str(x).lower() == 'true', []),
            'MULTI_ISSUE_SPLIT_ENABLED': ('multi_issue_split_enabled', lambda x: str(x).lower() == 'true', []),
            'STRIPE_PUBLIC_KEY': ('stripe_public_key', str, []),
            'STRIPE_SECRET_KEY': ('stripe_secret_key', str, []),
            'STRIPE_WEBHOOK_SECRET': ('stripe_webhook_secret', str, []),
            'STRIPE_MODE': ('stripe_mode', str, []),
        }

        changed = False
        update_fields = []

        for primary_key, (field_name, converter, alternates) in mapping.items():
            # Check primary key, then alternates
            env_val = os.environ.get(primary_key)
            if env_val is None:
                for alt_key in alternates:
                    env_val = os.environ.get(alt_key)
                    if env_val is not None:
                        break
            
            if env_val is not None:
                current_val = getattr(self, field_name)
                field = self._meta.get_field(field_name)
                default_val = field.default
                
                # Update if forced, or if current value is the default/empty
                is_empty_or_default = (current_val == default_val) or (current_val in [None, '', 0, 0.0])
                
                if force or is_empty_or_default:
                    try:
                        new_val = converter(env_val)
                        if new_val != current_val:
                            setattr(self, field_name, new_val)
                            changed = True
                            update_fields.append(field_name)
                    except (ValueError, TypeError):
                        pass

        # Also sync Gemini keys
        for i in range(1, 6):
            env_key = f"GEMINI_API_KEY_{i}"
            env_val = os.environ.get(env_key)
            if env_val:
                field_name = f"gemini_api_key_{i}"
                if force or not (getattr(self, field_name) or "").strip():
                    setattr(self, field_name, env_val.strip())
                    changed = True
                    update_fields.append(field_name)

        # SendGrid: SG.* API keys belong in smtp_password with smtp_user=apikey (not as username).
        sendgrid_key = (os.environ.get("SENDGRID_API_KEY") or "").strip()
        sendgrid_host = (
            os.environ.get("SMTP_HOST") or os.environ.get("EMAIL_HOST") or self.smtp_host or ""
        ).lower()
        if sendgrid_key.startswith("SG.") and "sendgrid" in sendgrid_host:
            user_val = (self.smtp_user or "").strip()
            if force or not user_val or user_val == sendgrid_key:
                self.smtp_user = "apikey"
                changed = True
                update_fields.append("smtp_user")
            if force or not (self.smtp_password or "").strip():
                self.smtp_password = sendgrid_key
                changed = True
                update_fields.append("smtp_password")

        if changed:
            self.save(update_fields=list(dict.fromkeys(update_fields)))
        return changed

    def get_gemini_api_keys(self, *, prefer_env: bool = True, sync_env_to_db: bool = True):
        """
        Returns a de-duplicated list of Gemini API keys using enumeration.

        Priority:
        - If prefer_env=True: ENV first, then DB
        - Else: DB first, then ENV

        Supported ENV formats:
        - GEMINI_API_KEY_1 .. GEMINI_API_KEY_5
        - GEMINI_API_KEYS (comma / whitespace separated)

        If sync_env_to_db=True, any GEMINI_API_KEY_N found in env will populate
        gemini_api_key_N in DB if the DB field is blank.
        """
        env_keys = []

        # Enumerated keys
        for i in range(1, 6):
            v = (os.environ.get(f"GEMINI_API_KEY_{i}") or "").strip()
            if v:
                env_keys.append((i, v))

        # Bulk list fallback
        bulk = (os.environ.get("GEMINI_API_KEYS") or "").strip()
        if bulk:
            for raw in re.split(r"[,\s]+", bulk):
                raw = (raw or "").strip()
                if raw:
                    env_keys.append((None, raw))

        if sync_env_to_db:
            changed = False
            for idx, val in env_keys:
                if idx is None:
                    continue
                field = f"gemini_api_key_{idx}"
                if not (getattr(self, field) or "").strip():
                    setattr(self, field, val)
                    changed = True
            if changed:
                self.save(update_fields=[f"gemini_api_key_{i}" for i in range(1, 6)])

        db_keys = []
        for i in range(1, 6):
            v = (getattr(self, f"gemini_api_key_{i}", "") or "").strip()
            if v:
                db_keys.append((i, v))

        ordered = []
        if prefer_env:
            ordered.extend([v for _, v in env_keys])
            ordered.extend([v for _, v in db_keys])
        else:
            ordered.extend([v for _, v in db_keys])
            ordered.extend([v for _, v in env_keys])

        # De-dupe while keeping order
        seen = set()
        unique = []
        for k in ordered:
            if k in seen:
                continue
            seen.add(k)
            unique.append(k)
        return unique

class Bid(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('withdrawn', 'Withdrawn'),
    ]
    
    request = models.ForeignKey('Request', on_delete=models.CASCADE, related_name='bids')
    provider = models.ForeignKey('Provider', on_delete=models.CASCADE, related_name='bids')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    proposal = models.TextField(help_text="Provider's proposal explaining why they're best for the job")
    estimated_duration = models.CharField(max_length=100, help_text="e.g., '2 hours', '1 day', '3-5 days'")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'bids'
        ordering = ['amount', '-created_at']
        unique_together = ['request', 'provider']
    
    def __str__(self):
        return f"Bid #{self.id} - {self.provider.user.username} on {self.request.title}"

# Import audit log model
from .audit import AuditLog

class Message(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages', null=True, blank=True)
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'messages'
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.username} in Job #{self.job.id}"
