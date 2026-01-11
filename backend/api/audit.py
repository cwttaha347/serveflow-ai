from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class AuditLog(models.Model):
    """Track all important system changes for admin review"""
    
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('status_change', 'Status Change'),
        ('bid_action', 'Bid Action'),
        ('payment', 'Payment'),
        ('login', 'Login'),
        ('logout', 'Logout'),
    ]
    
    # Who did it
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    username = models.CharField(max_length=150, help_text="Cached username in case user is deleted")
    user_role = models.CharField(max_length=20, blank=True)
    
    # What happened
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=50, help_text="Model that was changed")
    object_id = models.IntegerField(null=True, blank=True)
    object_repr = models.CharField(max_length=200, blank=True, help_text="String representation of object")
    
    # Details
    changes = models.JSONField(default=dict, help_text="Before/after values")
    description = models.TextField(blank=True)
    
    # Metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['model_name', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.username} - {self.action} {self.model_name} at {self.timestamp}"


def log_audit(user, action, model_name, obj=None, changes=None, description='', request=None):
    """Helper function to create audit log entries"""
    
    # Get IP and user agent from request if available
    ip_address = None
    user_agent = ''
    if request:
        ip_address = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
    
    # Create log
    AuditLog.objects.create(
        user=user,
        username=user.username if user else 'System',
        user_role=user.role if user and hasattr(user, 'role') else '',
        action=action,
        model_name=model_name,
        object_id=obj.id if obj and hasattr(obj, 'id') else None,
        object_repr=str(obj)[:200] if obj else '',
        changes=changes or {},
        description=description,
        ip_address=ip_address,
        user_agent=user_agent
    )
