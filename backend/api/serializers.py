from rest_framework import serializers
from .models import User, Profile, Category, Provider, Request, Job, Invoice, Review, Dispute, EmailLog, Bid

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['id', 'photo', 'bio', 'address', 'latitude', 'longitude', 'certifications']

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False, allow_null=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 
                  'phone', 'is_email_verified', 'is_active', 'profile', 'created_at']
        read_only_fields = ['id', 'created_at', 'username', 'role']

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
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone']
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        Profile.objects.create(user=user)
        
        if validated_data.get('role') == 'provider':
            Provider.objects.create(user=user)
            
        return user

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

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

class InvoiceSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)
    
    class Meta:
        model = Invoice
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
        fields = ['id', 'job', 'sender', 'sender_id', 'receiver', 'content', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at', 'sender']
