from django.db import models

class Message(models.Model):
    room = models.CharField(max_length=255)
    username = models.CharField(max_length=100)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    seen = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username}: {self.message}"