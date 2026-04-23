from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from .security import can_user_access_job

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope['user']
        if user.is_anonymous:
            await self.close()
        else:
            # Group name based on user ID
            self.group_name = f"user_{user.id}"
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive_json(self, content):
        # We generally push TO the user, not receive from them
        pass

    async def notify(self, event):
        # Handler for "notify" messages
        await self.send_json(event['content'])

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.job_id = self.scope['url_route']['kwargs']['job_id']
        self.room_group_name = f'chat_{self.job_id}'

        # Verify user is allowed in this room (optional but recommended)
        # For simplicity, we assume frontend sends valid job_id and auth handles the rest
        if self.scope['user'].is_anonymous:
             await self.close()
             return
        is_allowed = await self.user_can_join_room(self.scope['user'].id, self.job_id)
        if not is_allowed:
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive typing status
    async def receive_json(self, content):
        msg_type = content.get('type', 'message')
        sender_id = self.scope['user'].id

        if msg_type == 'typing':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_typing',
                    'sender_id': sender_id,
                    'is_typing': content.get('is_typing', False)
                }
            )
        elif msg_type == 'read_receipt':
            message_id = content.get('message_id')
            if message_id:
                await self.mark_as_read(message_id)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_read',
                        'message_id': message_id,
                        'reader_id': sender_id
                    }
                )
        else: # Default to handling as a chat message
            message = content.get('message')
            if not message:
                return
            
            msg_obj = await self.save_message(sender_id, self.job_id, message)
            if not msg_obj:
                await self.send_json({
                    'type': 'error',
                    'error': 'Unable to save message right now.'
                })
                return
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message_id': msg_obj.id,
                    'message': message,
                    'sender_id': sender_id,
                    'timestamp': msg_obj.created_at.isoformat()
                }
            )
            await self.channel_layer.group_send(
                f"user_{msg_obj.receiver_id}",
                {
                    'type': 'notify',
                    'content': {
                        'type': 'chat_message',
                        'message': message,
                        'payload': {
                            'job_id': msg_obj.job_id,
                            'message_id': msg_obj.id,
                            'sender_id': sender_id
                        }
                    }
                }
            )

    # Receive message from room group
    async def chat_message(self, event):
        await self.send_json({
            'type': 'chat_message',
            'message_id': event.get('message_id'),
            'message': event['message'],
            'sender_id': event['sender_id'],
            'timestamp': event.get('timestamp')
        })

    async def chat_typing(self, event):
        await self.send_json({
            'type': 'typing',
            'sender_id': event['sender_id'],
            'is_typing': event['is_typing']
        })

    async def chat_read(self, event):
        await self.send_json({
            'type': 'read_receipt',
            'message_id': event['message_id'],
            'reader_id': event['reader_id']
        })

    @database_sync_to_async
    def mark_as_read(self, message_id):
        from .models import Message
        from django.utils import timezone
        try:
            msg = Message.objects.get(id=message_id)
            if not msg.is_read:
                msg.is_read = True
                msg.read_at = timezone.now()
                msg.save()
        except Message.DoesNotExist:
            pass

    @database_sync_to_async
    def save_message(self, user_id, job_id, content):
        from .models import Message, Job, User
        try:
            user = User.objects.get(id=user_id)
            job = Job.objects.get(id=job_id)
            if not can_user_access_job(user, job):
                return None
            
            # Determine receiver
            receiver = job.provider.user if job.request.user == user else job.request.user
            
            return Message.objects.create(
                job=job,
                sender=user,
                receiver=receiver,
                content=content
            )
        except Exception as e:
            print(f"Error saving message: {e}")
            return None

    @database_sync_to_async
    def user_can_join_room(self, user_id, job_id):
        from .models import Job, User
        try:
            user = User.objects.get(id=user_id)
            job = Job.objects.get(id=job_id)
        except (User.DoesNotExist, Job.DoesNotExist):
            return False
        return can_user_access_job(user, job)
