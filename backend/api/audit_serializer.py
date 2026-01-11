from rest_framework import serializers
from .audit import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs"""
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'username', 'user_role', 'action', 'model_name',
            'object_id', 'object_repr', 'changes', 'description',
            'ip_address', 'timestamp'
        ]
        read_only_fields = fields  # All fields are read-only
