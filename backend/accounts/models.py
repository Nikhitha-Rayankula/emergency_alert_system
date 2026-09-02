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
    guardian = models.ForeignKey(
        'CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name="guardian_of_flat"
    )

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

    def __str__(self):
        return self.username


class SOSAlert(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sos_alerts')
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    responder = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='responded_sos'
    )
    issue_type = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SOS #{self.id} by {self.user}"


class Invite(models.Model):
    email = models.EmailField()
    group = models.ForeignKey('auth.Group', on_delete=models.CASCADE)
    gated_society = models.ForeignKey(GatedSociety, null=True, blank=True, on_delete=models.SET_NULL)
    flat = models.ForeignKey(Flat, null=True, blank=True, on_delete=models.SET_NULL)
    invited_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="invites_sent")
    token = models.CharField(max_length=64, unique=True, default=uuid.uuid4, editable=False)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)




