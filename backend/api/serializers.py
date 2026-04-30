from rest_framework import serializers
from .models import (
    User, Profile, Category, Provider, Request, Job, Invoice, Review, Dispute, EmailLog, Bid,
    Worker, WorkerLocationPing, ProviderLedgerEntry, ProviderPayout, RevenueSplitRule, JobStatusHistory,
)

def evaluate_profile_completion(user):
    """Hard-gate completion rules shared by auth/me responses."""
    if not user or getattr(user, "role", None) == "admin":
        return {
            "profile_completed": True,
            "missing_required_fields": [],
        }
        
    profile = getattr(user, 'profile', None)
    missing_fields = []
    
    # Phone check
    if not str(getattr(user, 'phone', '') or '').strip():
        missing_fields.append("phone")
        
    # Address check
    if not profile or not str(getattr(profile, 'address', '') or '').strip():
        missing_fields.append("address")
        
    return {
        "profile_completed": len(missing_fields) == 0,
        "missing_required_fields": missing_fields,
    }


def evaluate_provider_onboarding(user):
    if getattr(user, "role", None) != "provider":
        return {
            "provider_onboarding_completed": True,
            "provider_onboarding_required": False,
        }
    provider = getattr(user, "provider_profile", None)
    completed = bool(provider and provider.onboarding_completed)
    return {
        "provider_onboarding_completed": completed,
        "provider_onboarding_required": not completed,
    }

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['id', 'photo', 'bio', 'address', 'latitude', 'longitude', 'certifications']

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False, allow_null=True)
    profile_completed = serializers.SerializerMethodField()
    missing_required_fields = serializers.SerializerMethodField()
    provider_onboarding_completed = serializers.SerializerMethodField()
    provider_onboarding_required = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role',
                  'phone', 'is_email_verified', 'is_active', 'profile',
                  'profile_completed', 'missing_required_fields',
                  'provider_onboarding_completed', 'provider_onboarding_required',
                  'created_at']
        read_only_fields = ['id', 'created_at', 'username', 'role']

    def get_profile_completed(self, obj):
        return evaluate_profile_completion(obj)["profile_completed"]

    def get_missing_required_fields(self, obj):
        return evaluate_profile_completion(obj)["missing_required_fields"]

    def get_provider_onboarding_completed(self, obj):
        return evaluate_provider_onboarding(obj)["provider_onboarding_completed"]

    def get_provider_onboarding_required(self, obj):
        return evaluate_provider_onboarding(obj)["provider_onboarding_required"]

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if profile_data:
            # Get or create profile if it doesn't exist
            profile, created = Profile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
            
        return instance

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    category_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone', 'category_ids']

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken. Please choose another.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists. Try logging in.")
        return value

    def validate(self, attrs):
        role = attrs.get('role') or 'user'
        if role not in ['user', 'provider']:
            raise serializers.ValidationError({"role": "Invalid role selection."})
        if attrs.get('role') == 'provider' and not attrs.get('category_ids'):
            raise serializers.ValidationError({"category_ids": "Providers must select at least one category."})
        return attrs
    
    def create(self, validated_data):
        category_ids = validated_data.pop('category_ids', [])
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        Profile.objects.create(user=user)
        
        if validated_data.get('role') == 'provider':
            provider = Provider.objects.create(user=user)
            categories = Category.objects.filter(id__in=category_ids)
            if categories.exists():
                provider.categories.set(categories)
            
        return user

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
    
    def validate_name(self, value):
        """
        Check that the name is unique, excluding the current instance during updates
        """
        # Get the instance being updated (if this is an update operation)
        instance = self.instance
        
        # Check if another category with this name exists
        queryset = Category.objects.filter(name=value)
        
        # If updating, exclude the current instance from the uniqueness check
        if instance:
            queryset = queryset.exclude(pk=instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError("A category with this name already exists.")
        
        return value

class ProviderSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    
    class Meta:
        model = Provider
        fields = '__all__'

class RequestSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    job_id = serializers.SerializerMethodField()
    invoice_id = serializers.SerializerMethodField()
    class Meta:
        model = Request
        fields = '__all__'
        read_only_fields = ['user', 'ai_summary', 'created_at', 'updated_at', 'job_id', 'invoice_id']

    def get_job_id(self, obj):
        job = obj.jobs.filter(status__in=['accepted', 'started', 'completed']).first()
        return job.id if job else None

    def get_invoice_id(self, obj):
        job = obj.jobs.filter(status__in=['accepted', 'started', 'completed']).first()
        if job and hasattr(job, 'invoice'):
            return job.invoice.id
        return None

class JobSerializer(serializers.ModelSerializer):
    request = RequestSerializer(read_only=True)
    provider = ProviderSerializer(read_only=True)
    
    class Meta:
        model = Job
        fields = '__all__'


class WorkerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Worker
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class WorkerLocationPingSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkerLocationPing
        fields = '__all__'
        read_only_fields = ['created_at']

class InvoiceSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)
    
    class Meta:
        model = Invoice
        fields = '__all__'


class RevenueSplitRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RevenueSplitRule
        fields = '__all__'


class ProviderLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderLedgerEntry
        fields = '__all__'


class ProviderPayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderPayout
        fields = '__all__'


class JobStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = JobStatusHistory
        fields = '__all__'

class ReviewSerializer(serializers.ModelSerializer):
    job_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Review
        fields = ['id', 'job', 'job_id', 'rating', 'comment', 'created_at']
        read_only_fields = ['job', 'created_at']

class BidSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.user.username', read_only=True)
    provider_rating = serializers.DecimalField(source='provider.rating', max_digits=3, decimal_places=2, read_only=True)
    request_title = serializers.CharField(source='request.title', read_only=True)
    
    class Meta:
        model = Bid
        fields = ['id', 'request', 'provider', 'provider_name', 'provider_rating', 
                  'request_title', 'amount', 'proposal', 'estimated_duration', 
                  'status', 'created_at', 'updated_at']
        read_only_fields = ['status', 'created_at', 'updated_at']


class DisputeSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)
    raised_by = UserSerializer(read_only=True)
    
    class Meta:
        model = Dispute
        fields = '__all__'

class EmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailLog
        fields = '__all__'

from .models import Message

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    sender_id = serializers.IntegerField(write_only=True, required=False) # Optional for manually setting sender
    class Meta:
        model = Message
        fields = ['id', 'job', 'sender', 'sender_id', 'receiver', 'content', 'is_read', 'read_at', 'created_at']
        read_only_fields = ['id', 'created_at', 'sender']
