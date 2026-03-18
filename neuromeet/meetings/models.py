from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

class Meeting(models.Model):

    room = models.CharField(
        max_length=50,
        unique=True
    )

    created = models.DateTimeField(
        auto_now_add=True
    )


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    avatar = models.FileField(upload_to='avatars/', blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True)
    company = models.CharField(max_length=120, blank=True)
    job_title = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=60, blank=True)
    city = models.CharField(max_length=60, blank=True)
    timezone = models.CharField(max_length=60, blank=True)
    linkedin = models.URLField(blank=True)
    twitter = models.URLField(blank=True)
    github = models.URLField(blank=True)
    default_mic = models.CharField(max_length=80, blank=True, default='default')
    default_speaker = models.CharField(max_length=80, blank=True, default='default')
    noise_cancellation = models.BooleanField(default=True)
    auto_transcription = models.BooleanField(default=True)
    email_reminders = models.BooleanField(default=True)
    weekly_summary = models.BooleanField(default=True)
    product_updates = models.BooleanField(default=False)

    def __str__(self):
        return f"Profile({self.user.username})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
