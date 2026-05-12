from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import NotificationItem

def send_notification(user_id, message, type='info', payload=None):
    """
    Send a real-time notification to a specific user.
    """
    channel_layer = get_channel_layer()
    group_name = f"user_{user_id}"

    # Derive title: prefer payload["title"], fall back to message text
    raw_title = ""
    if isinstance(payload, dict):
        raw_title = payload.get("title") or ""
    if not raw_title:
        raw_title = message or ""
    NotificationItem.objects.create(
        user_id=user_id,
        event_type=type,
        title=str(raw_title)[:200],
        message=message,
        payload=payload or {},
    )

    event = {
        'type': 'notify',  # This matches the method name in the consumer
        'content': {
            'message': message,
            'type': type,
            'payload': payload or {}
        }
    }

    print(f"DEBUG: Sending WS notification to {group_name}: {message}")
    async_to_sync(channel_layer.group_send)(group_name, event)

def notify_request_update(request_obj, message):
    # Notify the request owner
    send_notification(
        user_id=request_obj.user.id,
        message=message,
        type='request_update',
        payload={'request_id': request_obj.id, 'status': request_obj.status}
    )

def notify_job_update(job_obj, message, recipient_user):
    # Notify a specific user about a job
    send_notification(
        user_id=recipient_user.id,
        message=message,
        type='job_update',
        payload={
            'job_id': job_obj.id,
            'request_id': getattr(job_obj, 'request_id', None) or (job_obj.request.id if getattr(job_obj, 'request', None) else None),
            'status': job_obj.status,
        },
    )
