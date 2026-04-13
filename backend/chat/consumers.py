from channels.generic.websocket import AsyncWebsocketConsumer
import json
from .models import Message
from asgiref.sync import sync_to_async

# 🔥 store online users in memory (simple version)
ONLINE_USERS = set()

class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.group_name = f"chat_{self.room_name}"

        self.username = None

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

        # history send
        messages = await self.get_messages()
        await self.send(text_data=json.dumps({
            "history": messages
        }))

    async def disconnect(self, close_code):
        if self.username in ONLINE_USERS:
            ONLINE_USERS.remove(self.username)

        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)

        message = data.get("message")
        username = data.get("username")

        self.username = username  # store user

        # 🔥 ONLINE STATUS
        if data.get("online"):
            ONLINE_USERS.add(username)

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user_status",
                    "username": username,
                    "status": "online"
                }
            )
            return

        # 🔥 TYPING
        if data.get("typing"):
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "typing_event",
                    "username": username
                }
            )
            return

        # 🔥 SEEN
        if data.get("seen"):
            await self.mark_seen()

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "seen_update",
                    "username": username
                }
            )
            return

        # 🔥 SAVE MESSAGE
        await self.save_message(username, message)

        # 🔥 BROADCAST MESSAGE
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "message": message,
                "username": username
            }
        )

    # ================= EVENTS =================

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "message": event["message"],
            "username": event["username"],
            "seen": False
        }))

    async def typing_event(self, event):
        await self.send(text_data=json.dumps({
            "typing": True,
            "username": event["username"]
        }))

    async def seen_update(self, event):
        await self.send(text_data=json.dumps({
            "seen": True,
            "username": event["username"]
        }))

    async def user_status(self, event):
        await self.send(text_data=json.dumps({
            "online": event["status"],
            "username": event["username"]
        }))

    # ================= DB =================

    @sync_to_async
    def save_message(self, username, message):
        Message.objects.create(
            room=self.room_name,
            username=username,
            message=message
        )

    @sync_to_async
    def mark_seen(self):
        Message.objects.filter(room=self.room_name).update(seen=True)

    @sync_to_async
    def get_messages(self):
        msgs = Message.objects.filter(room=self.room_name).order_by("timestamp")

        return [
            {
                "username": m.username,
                "message": m.message,
                "time": m.timestamp.strftime("%H:%M"),
                "seen": m.seen
            }
            for m in msgs
        ]