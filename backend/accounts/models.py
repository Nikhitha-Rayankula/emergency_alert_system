from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid
import random
from django.utils import timezone
from datetime import timedelta

class OTP(models.Model):
    email = models.EmailField()
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=30, default="registration")
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def is_valid(self):
        return not self.is_used and (timezone.now() - self.created_at) < timedelta(minutes=5)

    @staticmethod
    def generate(email, purpose="registration"):
        code = str(random.randint(100000, 999999))
        return OTP.objects.create(email=email, code=code, purpose=purpose)

class GatedSociety(models.Model):
    society_name = models.CharField(max_length=255)
    owner_name = models.CharField(max_length=255)
    incharge = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sub_admin = models.ForeignKey(
        'CustomUser', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_societies'
    )

    def __str__(self):
        return self.society_name


class Block(models.Model):
    gated_society = models.ForeignKey(GatedSociety, on_delete=models.CASCADE, related_name="blocks")
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)

    def __str__(self):
        return f"{self.gated_society.society_name} - {self.name}"



class Flat(models.Model):
    block = models.ForeignKey(Block, on_delete=models.CASCADE, related_name="flats")
    flat_number = models.CharField(max_length=20)
    floor = models.IntegerField(null=True, blank=True)
    flat_type = models.CharField(max_length=20, blank=True)
    guardian = models.ForeignKey('CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name="guardian_of_flat")
    secondary_guardian = models.ForeignKey('CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name="secondary_guardian_of_flat")

    def __str__(self):
        return f"{self.block} - {self.flat_number}"



class CustomUser(AbstractUser):
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    email = models.EmailField(unique=True)
    mobile = models.CharField(max_length=15, blank=True, null=True)
    emergency_contact1 = models.JSONField(blank=True, null=True)
    emergency_contact2 = models.JSONField(blank=True, null=True)
    emergency_contact3 = models.JSONField(blank=True, null=True)
    gated_society = models.ForeignKey(GatedSociety, on_delete=models.SET_NULL, null=True, blank=True, related_name='residents_in_society')
    flat = models.ForeignKey(Flat, on_delete=models.SET_NULL, null=True, blank=True, related_name="members")
    group = models.ForeignKey('auth.Group', on_delete=models.PROTECT, related_name='profile_users')
    available = models.BooleanField(default=True)
    last_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    def __str__(self):
        return self.username


class SOSAlert(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("active_response", "Active Response"),
        ("escalated", "Escalated"),
        ("resolved", "Resolved"),
        ("closed", "Closed"),
        ("cancelled", "Cancelled"),
    ]
    CATEGORY_CHOICES = [
        ("medical", "Medical Emergency"),
        ("fall", "Fall/Accident"),
        ("security", "Security Concern"),
        ("other", "Other"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sos_alerts')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="other")
    message = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    responder = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='responded_sos'
    )
    escalation_level = models.IntegerField(default=0)
    last_stage_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"SOS #{self.id} by {self.user} - {self.status}"

class Invite(models.Model):
    email = models.EmailField()
    group = models.ForeignKey('auth.Group', on_delete=models.CASCADE)
    gated_society = models.ForeignKey(GatedSociety, null=True, blank=True, on_delete=models.SET_NULL)
    flat = models.ForeignKey(Flat, null=True, blank=True, on_delete=models.SET_NULL)
    invited_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="invites_sent")
    token = models.CharField(max_length=64, unique=True, default=uuid.uuid4, editable=False)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)



class Notification(models.Model):
    recipient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    sos = models.ForeignKey(SOSAlert, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    is_read = models.BooleanField(default=False)
    email_delivered = models.BooleanField(default=False)
    sms_delivered = models.BooleanField(default=False)
    push_delivered = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    

class DeviceToken(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="device_tokens")
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}'s device"


class IncidentHistory(models.Model):
    sos = models.ForeignKey(SOSAlert, on_delete=models.CASCADE, related_name="history")
    action = models.CharField(max_length=100)
    performed_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class EscalationConfig(models.Model):
    gated_society = models.OneToOneField(GatedSociety, on_delete=models.CASCADE, related_name="escalation_config")
    response_timeout_seconds = models.IntegerField(default=60)
    primary_guardian_enabled = models.BooleanField(default=True)
    secondary_guardian_enabled = models.BooleanField(default=True)
    emergency_contact_enabled = models.BooleanField(default=True)

class IncidentMessage(models.Model):
    sos = models.ForeignKey(SOSAlert, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)