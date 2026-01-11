from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def send_notification(user_id, message, type='info', payload=None):
    """
    Send a real-time notification to a specific user.
    """
    channel_layer = get_channel_layer()
    group_name = f"user_{user_id}"

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
        payload={'job_id': job_obj.id, 'status': job_obj.status}
    )
