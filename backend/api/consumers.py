from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

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

    # Receive message from WebSocket
    async def receive_json(self, content):
        message = content.get('message')
        sender_id = self.scope['user'].id
        
        if not message:
            return

        # Save to database (Sync to Async)
        from channels.db import database_sync_to_async
        from .models import Message, Job, User
        
        await self.save_message(sender_id, self.job_id, message)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender_id': sender_id,
                'timestamp': str(content.get('timestamp', 'Now')) # Or use server time
            }
        )

    # Receive message from room group
    async def chat_message(self, event):
        await self.send_json({
            'type': 'chat_message',
            'message': event['message'],
            'sender_id': event['sender_id'],
            'timestamp': event.get('timestamp')
        })

    @database_sync_to_async
    def save_message(self, user_id, job_id, content):
        from .models import Message, Job, User
        try:
            user = User.objects.get(id=user_id)
            job = Job.objects.get(id=job_id)
            
            # Determine receiver
            receiver = job.provider.user if job.request.user == user else job.request.user
            
            Message.objects.create(
                job=job,
                sender=user,
                receiver=receiver,
                content=content
            )
        except Exception as e:
            print(f"Error saving message: {e}")
