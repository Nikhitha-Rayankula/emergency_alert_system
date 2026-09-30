from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from rest_framework import serializers
from .models import CustomUser, GatedSociety, Invite, Block, Flat, OTP, SOSAlert, Notification, DeviceToken, IncidentHistory,EscalationConfig, IncidentMessage
from django.core.mail import send_mail, EmailMessage, get_connection
from django.conf import settings
from twilio.rest import Client
from .firebase import send_push_notification
import math
from django.utils import timezone

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(float(lat2) - float(lat1))
    dlon = math.radians(float(lon2) - float(lon1))
    a = math.sin(dlat/2)**2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def log_incident(sos, action, user=None, note=""):
    IncidentHistory.objects.create(sos=sos, action=action, performed_by=user, note=note)

def send_sms(to_number, body):
    if not to_number:
        return False
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(body=body, from_=settings.TWILIO_PHONE_NUMBER, to=to_number)
        return True
    except Exception as e:
        print(f"SMS failed: {e}")
        return False

def send_invite_email(invite):
    link = f"{settings.FRONTEND_BASE_URL}/api/auth/register/invite/{invite.token}/"
    send_mail(
        subject="You're invited to join Emergency Response Platform",
        message=f"Click the link to complete your registration:\n\n{link}",
        from_email=None,
        recipient_list=[invite.email],
    )


def notify_user(sos, recipient):
    title = f"Emergency Alert: {sos.get_category_display()}"
    body = f"{sos.user.username} needs help.\nLocation: {sos.latitude}, {sos.longitude}\n{sos.message}"

    notif = Notification.objects.create(recipient=recipient, title=title, message=body, sos=sos)

    try:
        send_mail(subject=title, message=body, from_email=None, recipient_list=[recipient.email])
        notif.email_delivered = True
        log_incident(sos, "email_sent", None, f"To {recipient.username} ({recipient.group.name})")
    except Exception as e:
        print(f"Email failed for {recipient.username}: {e}")
        log_incident(sos, "email_failed", None, f"To {recipient.username}: {e}")

        if recipient.mobile:
            if send_sms(recipient.mobile, f"{title}\n{body}"):
                notif.sms_delivered = True
                log_incident(sos, "sms_sent", None, f"To {recipient.username} ({recipient.group.name})")
            else:
                log_incident(sos, "sms_failed", None, f"To {recipient.username}")
    
    for dt in DeviceToken.objects.filter(user=recipient):
        result = send_push_notification(dt.token, title, body)
        if result:
            notif.push_delivered = True
            log_incident(sos, "push_sent", None, f"To {recipient.username}")

    notif.save()

MAX_STAGE = 6

STAGE_LABELS = {
    1: "Primary Guardian",
    2: "Sub Admin & Security",
    3: "Volunteers",
    4: "Community residents",
    5: "Secondary Guardian",
    6: "Emergency contacts",
}


def get_stage_recipients(sos, level):
    user = sos.user
    society = user.gated_society
    recipients = []

    if level == 1:
        if user.flat and user.flat.guardian and user.flat.guardian != user:
            recipients.append(user.flat.guardian)

    elif level == 2 and society:
        if society.sub_admin:
            recipients.append(society.sub_admin)
        group = Group.objects.filter(name="Security").first()
        if group:
            recipients += list(CustomUser.objects.filter(gated_society=society, group=group))

    elif level == 3 and society:
        group = Group.objects.filter(name="Volunteer").first()
        if group:
            recipients += list(CustomUser.objects.filter(gated_society=society, group=group))

    elif level == 4 and society:
        group = Group.objects.filter(name="Resident").first()
        if group:
            recipients += list(
                CustomUser.objects.filter(gated_society=society, group=group).exclude(id=user.id)
            )

    elif level == 5:
        if user.flat and user.flat.secondary_guardian:
            recipients.append(user.flat.secondary_guardian)

    return recipients


def still_pending(sos):
    return SOSAlert.objects.filter(id=sos.id, status__in=["open", "escalated"]).exists()


def run_stage(sos, level):
    count = 0
    already_notified = set(
        Notification.objects.filter(sos=sos).values_list("recipient_id", flat=True)
    )

    if level == 6:
        user = sos.user
        for field in ["emergency_contact1", "emergency_contact2", "emergency_contact3"]:
            if not still_pending(sos):
                break
            contact = getattr(user, field)
            if contact and contact.get("phone_number"):
                ok = send_sms(
                    contact["phone_number"],
                    f"EMERGENCY: {user.username} needs help. Location: {sos.latitude}, {sos.longitude}",
                )
                log_incident(
                    sos,
                    "emergency_contact_sms_sent" if ok else "emergency_contact_sms_failed",
                    None,
                    contact.get("name", "contact"),
                )
                count += 1
        return count

    for recipient in get_stage_recipients(sos, level):
        if not still_pending(sos):
            break                      # someone accepted mid-stage: stop sending
        if recipient.id in already_notified:
            continue                   # never notify the same person twice
        notify_user(sos, recipient)
        count += 1
    return count


def notify_next_stage(sos):
    """Sends exactly ONE stage per call, then returns. Empty stages are skipped."""
    level = sos.escalation_level
    while level < MAX_STAGE and still_pending(sos):
        level += 1
        sos.escalation_level = level
        sos.last_stage_at = timezone.now()
        sos.save(update_fields=["escalation_level", "last_stage_at"])
        print(f"[escalation] SOS {sos.id} -> stage {level}")

        count = run_stage(sos, level)
        if count > 0:
            log_incident(sos, f"stage_{level}_notified", None, f"{STAGE_LABELS[level]} ({count} contacted)")
            return level          # stop here and wait for the timer
        log_incident(sos, f"stage_{level}_skipped", None, f"{STAGE_LABELS[level]}: nobody new to notify")
    return level

def route_sos_notifications(sos):
    from .tasks import send_next_stage   # imported here to avoid a circular import
    send_next_stage.delay(sos.id)

class ProfileSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            "id", "username", "email", "mobile", "first_name", "last_name",
            "emergency_contact1", "emergency_contact2", "emergency_contact3",
            "gated_society", "group", "group_name",
        ]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    group_name = serializers.ChoiceField(choices=["Volunteer", "Guardian", "Resident"], write_only=True, default="Resident", required=False)
    gated_society = serializers.PrimaryKeyRelatedField(queryset=GatedSociety.objects.all(), required=False, allow_null=True)
    flat = serializers.PrimaryKeyRelatedField(queryset=Flat.objects.all(), required=False, allow_null=True)

    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "password", "mobile",
                  "emergency_contact1", "emergency_contact2", "emergency_contact3", "group_name", "gated_society", "flat",]

    def validate(self, attrs):
        group = attrs.get("group_name", "Resident")
        # Ensure group_name is set
        if "group_name" not in attrs:
            attrs["group_name"] = group
        return attrs

    def create(self, validated_data):
        group_name = validated_data.pop("group_name")
        password = validated_data.pop("password")
        group, _ = Group.objects.get_or_create(name=group_name)
        user = CustomUser(**validated_data, group=group, is_active=False)
        user.set_password(password)
        user.save()

        otp = OTP.generate(user.email, "registration")
        send_mail("Verify your email", f"Your OTP is {otp.code}. It expires in 5 minutes.", None, [user.email])
        return user


class UpdateProfileSerializer(serializers.ModelSerializer):
    """gated_society and group are deliberately excluded — user can't self-edit these."""
    class Meta:
        model = CustomUser
        fields = [
            "username", "email", "mobile", "first_name", "last_name",
            "emergency_contact1", "emergency_contact2", "emergency_contact3",
        ]



class GatedSocietySerializer(serializers.ModelSerializer):
    sub_admin_username = serializers.CharField(write_only=True, required=False)
    sub_admin = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = GatedSociety
        fields = ["id", "society_name", "owner_name", "incharge", "sub_admin", "sub_admin_username", "created_at", "updated_at"]

    def create(self, validated_data):
        username = validated_data.pop("sub_admin_username", None)
        if username:
            try:
                validated_data["sub_admin"] = CustomUser.objects.get(username=username, group__name="Sub Admin")
            except CustomUser.DoesNotExist:
                raise serializers.ValidationError({"sub_admin_username": "No Sub Admin found with that username."})
        return GatedSociety.objects.create(**validated_data)

    def update(self, instance, validated_data):
        username = validated_data.pop("sub_admin_username", None)
        if username:
            try:
                instance.sub_admin = CustomUser.objects.get(username=username, group__name="Sub Admin")
            except CustomUser.DoesNotExist:
                raise serializers.ValidationError({"sub_admin_username": "No Sub Admin found with that username."})
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance




class InviteAdminSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def create(self, validated_data):
        group, _ = Group.objects.get_or_create(name="Admin")
        invite = Invite.objects.create(
            email=validated_data["email"],
            group=group,
            invited_by=self.context["request"].user,
        )
        send_invite_email(invite)
        return invite


class InviteSubAdminSerializer(serializers.Serializer):
    email = serializers.EmailField()
    gated_society = serializers.PrimaryKeyRelatedField(queryset=GatedSociety.objects.all())

    def create(self, validated_data):
        group, _ = Group.objects.get_or_create(name="Sub Admin")
        invite = Invite.objects.create(
            email=validated_data["email"],
            group=group,
            gated_society=validated_data["gated_society"],
            invited_by=self.context["request"].user,
        )
        send_invite_email(invite)
        return invite


class InviteVolunteerSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def create(self, validated_data):
        request_user = self.context["request"].user
        group, _ = Group.objects.get_or_create(name="Volunteer")
        # If a Sub Admin invites, auto-derive their own society. Admin inviting directly = no society tie.
        society = GatedSociety.objects.filter(sub_admin=request_user).first() if request_user.group.name == "Sub Admin" else None
        invite = Invite.objects.create(
            email=validated_data["email"],
            group=group,
            gated_society=society,
            invited_by=request_user,
        )
        send_invite_email(invite)
        return invite


class InviteGuardianSerializer(serializers.Serializer):
    email = serializers.EmailField()
    flat = serializers.PrimaryKeyRelatedField(queryset=Flat.objects.all())

    def create(self, validated_data):
        request_user = self.context["request"].user
        group, _ = Group.objects.get_or_create(name="Guardian")
        society = GatedSociety.objects.filter(sub_admin=request_user).first()
        invite = Invite.objects.create(
            email=validated_data["email"],
            group=group,
            gated_society=society,
            flat=validated_data["flat"],
            invited_by=request_user,
        )
        send_invite_email(invite)
        return invite


class RegisterViaInviteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    token = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "password", "mobile", "token"]

    def validate(self, attrs):
        try:
            invite = Invite.objects.get(token=attrs["token"], is_used=False)
        except Invite.DoesNotExist:
            raise serializers.ValidationError("Invalid or already-used invite token.")
        if invite.email != attrs["email"]:
            raise serializers.ValidationError("Email does not match the invited address.")
        attrs["_invite"] = invite
        return attrs

    def create(self, validated_data):
        invite = validated_data.pop("_invite")
        validated_data.pop("token")
        password = validated_data.pop("password")
        user = CustomUser(
            **validated_data,
            group=invite.group,
            gated_society=invite.gated_society,
            flat=invite.flat,
        )
        user.set_password(password)
        user.save()

        if invite.group.name == "Sub Admin" and invite.gated_society:
            invite.gated_society.sub_admin = user
            invite.gated_society.save()

        if invite.group.name == "Guardian" and invite.flat:
            invite.flat.guardian = user
            invite.flat.save()
            
        invite.is_used = True
        invite.save()
        return user


class BlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = Block
        fields = ["id", "gated_society", "name", "code"]


class FlatSerializer(serializers.ModelSerializer):
    guardian = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Flat
        fields = ["id", "block", "flat_number", "floor", "flat_type", "guardian"]



class AddResidentSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    flat = serializers.PrimaryKeyRelatedField(queryset=Flat.objects.all(), required=False)

    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "password", "mobile", "flat"]

    def validate(self, attrs):
        request_user = self.context["request"].user

        if request_user.group.name == "Guardian":
            # Guardian always adds to their own flat — flat field is ignored/not needed
            if not request_user.flat:
                raise serializers.ValidationError("You are not assigned to a flat.")
            attrs["flat"] = request_user.flat

        elif request_user.group.name == "Sub Admin":
            # Sub Admin must specify which flat, and it must be in their own society
            flat = attrs.get("flat")
            if not flat:
                raise serializers.ValidationError({"flat": "This field is required."})
            society = GatedSociety.objects.filter(sub_admin=request_user).first()
            if not society or flat.block.gated_society_id != society.id:
                raise serializers.ValidationError({"flat": "This flat does not belong to your society."})

        return attrs

    def create(self, validated_data):
        group, _ = Group.objects.get_or_create(name="Resident")
        password = validated_data.pop("password")
        flat = validated_data.pop("flat")
        user = CustomUser(
            **validated_data,
            group=group,
            flat=flat,
            gated_society=flat.block.gated_society,
        )
        user.set_password(password)
        user.save()
        return user

class InviteSecuritySerializer(serializers.Serializer):
    email = serializers.EmailField()

    def create(self, validated_data):
        request_user = self.context["request"].user
        society = GatedSociety.objects.filter(sub_admin=request_user).first()
        if not society:
            raise serializers.ValidationError("You are not assigned as sub_admin of any society yet.")
        group, _ = Group.objects.get_or_create(name="Security")
        invite = Invite.objects.create(
            email=validated_data["email"], group=group, gated_society=society, invited_by=request_user,
        )
        send_invite_email(invite)
        return invite


class SendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.CharField(default="registration")

    def create(self, validated_data):
        otp = OTP.generate(validated_data["email"], validated_data["purpose"])
        send_mail("Your OTP Code", f"Your code is {otp.code}. Expires in 5 minutes.", None, [otp.email])
        return otp


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField()

    def validate(self, attrs):
        try:
            otp_obj = OTP.objects.filter(email=attrs["email"], code=attrs["otp"]).latest("created_at")
        except OTP.DoesNotExist:
            raise serializers.ValidationError({"otp": "Invalid OTP."})
        if not otp_obj.is_valid():
            raise serializers.ValidationError({"otp": "OTP expired or already used."})
        otp_obj.is_used = True
        otp_obj.save()
        CustomUser.objects.filter(email=attrs["email"]).update(is_active=True)
        return attrs

    def create(self, validated_data):
        return {"detail": "Account verified successfully."}


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)

    def validate(self, attrs):
        request = self.context.get("request")
        email = attrs.get("email") or (request.user.email if request and request.user.is_authenticated else None)
        if not email:
            raise serializers.ValidationError({"email": "Email address is required."})
        if not CustomUser.objects.filter(email=email).exists():
            raise serializers.ValidationError({"email": "No account found with this email address."})
        attrs["resolved_email"] = email
        return attrs

    def create(self, validated_data):
        email = validated_data["resolved_email"]
        otp = OTP.generate(email, "forgot_password")
        send_mail(
            "Password Reset Code",
            f"Your password reset code is {otp.code}. It expires in 5 minutes.",
            None,
            [email],
        )
        return {"detail": "Password reset code sent to your email."}


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(write_only=True, required=False)
    otp = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        request = self.context.get("request")
        # Support both logged-out (email in body) and logged-in (request.user)
        email = attrs.get("email") or (request.user.email if request and request.user.is_authenticated else None)
        if not email:
            raise serializers.ValidationError({"email": "Email is required."})

        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({"email": "No account found with this email."})

        try:
            otp_obj = OTP.objects.filter(
                email=email, code=attrs["otp"], purpose="forgot_password"
            ).latest("created_at")
        except OTP.DoesNotExist:
            raise serializers.ValidationError({"otp": "Invalid OTP."})

        if not otp_obj.is_valid():
            raise serializers.ValidationError({"otp": "OTP expired or already used."})

        attrs["user"] = user
        attrs["otp_obj"] = otp_obj
        return attrs

    def create(self, validated_data):
        user = validated_data["user"]
        otp_obj = validated_data["otp_obj"]
        otp_obj.is_used = True
        otp_obj.save()
        user.set_password(validated_data["new_password"])
        user.save()
        return {"detail": "Password reset successfully."}


class TriggerSOSSerializer(serializers.ModelSerializer):
    class Meta:
        model = SOSAlert
        fields = ["id", "category", "message", "latitude", "longitude", "status", "created_at"]
        read_only_fields = ["status", "created_at"]

    def create(self, validated_data):
        user = self.context["request"].user
        sos = SOSAlert.objects.create(user=user, **validated_data)
        log_incident(sos, "incident_created", user)
        route_sos_notifications(sos)
        return sos


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "sos", "is_read",
                  "email_delivered", "sms_delivered", "push_delivered", "created_at"]


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ["id", "token"]

    def create(self, validated_data):
        user = self.context["request"].user
        obj, _ = DeviceToken.objects.update_or_create(
            user=user, token=validated_data["token"], defaults={}
        )
        return obj


class AssignSocietySerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    gated_society = serializers.PrimaryKeyRelatedField(queryset=GatedSociety.objects.all())

    def create(self, validated_data):
        try:
            target = CustomUser.objects.get(id=validated_data["user_id"])
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({"user_id": "User not found."})
        target.gated_society = validated_data["gated_society"]
        target.save()
        return {"detail": f"{target.username} assigned to {validated_data['gated_society'].society_name}."}


class UpdateSOSStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SOSAlert.STATUS_CHOICES)

    def update(self, instance, validated_data):
        instance.status = validated_data["status"]
        if validated_data["status"] == "resolved":
            from django.utils import timezone
            instance.resolved_at = timezone.now()
        instance.save()
        return instance


class AcceptSOSSerializer(serializers.Serializer):
    def update(self, instance, validated_data):
        instance.responder = self.context["request"].user
        instance.status = "active_response"
        instance.save()
        log_incident(instance, "incident_accepted", self.context["request"].user)
        return instance

class SOSDetailSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    responder = serializers.StringRelatedField()

    class Meta:
        model = SOSAlert
        fields = ["id", "user", "category", "message", "latitude", "longitude",
                  "status", "responder", "created_at", "resolved_at"]


class IncidentHistorySerializer(serializers.ModelSerializer):
    performed_by = serializers.StringRelatedField()

    class Meta:
        model = IncidentHistory
        fields = ["id", "action", "performed_by", "note", "created_at"]


class ResolveIncidentSerializer(serializers.Serializer):
    resolution = serializers.CharField(write_only=True)

    def update(self, instance, validated_data):
        instance.status = "resolved"
        from django.utils import timezone
        instance.resolved_at = timezone.now()
        instance.save()
        log_incident(instance, "incident_resolved", self.context["request"].user, validated_data["resolution"])
        return instance


class CloseIncidentSerializer(serializers.Serializer):
    closure_note = serializers.CharField(write_only=True)

    def update(self, instance, validated_data):
        instance.status = "closed"
        instance.save()
        log_incident(instance, "incident_closed", self.context["request"].user, validated_data["closure_note"])
        return instance

class EscalateSOSSerializer(serializers.Serializer):
    reason = serializers.CharField(write_only=True)

    def update(self, instance, validated_data):
        user = instance.user
        escalated_to = []

        if user.flat and user.flat.secondary_guardian:
            notify_user(instance, user.flat.secondary_guardian)
            escalated_to.append(user.flat.secondary_guardian.username)

        for field in ["emergency_contact1", "emergency_contact2", "emergency_contact3"]:
            contact = getattr(user, field)
            if contact and contact.get("phone_number"):
                send_sms(contact["phone_number"], f"EMERGENCY: {user.username} needs help. {validated_data['reason']}")
                escalated_to.append(contact.get("name", "emergency contact"))

        instance.status = "escalated"
        instance.save()
        log_incident(instance, "incident_escalated", self.context["request"].user,
                     f"Reason: {validated_data['reason']}. Escalated to: {', '.join(escalated_to) or 'no one configured'}")
        return instance


class EscalationConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = EscalationConfig
        fields = ["response_timeout_seconds", "primary_guardian_enabled", "secondary_guardian_enabled", "emergency_contact_enabled"]

class AvailabilitySerializer(serializers.Serializer):
    available = serializers.BooleanField()

    def update(self, instance, validated_data):
        instance.available = validated_data["available"]
        instance.save()
        return instance


class LocationSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6,write_only=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6,write_only=True)

    def update(self, instance, validated_data):
        if "latitude" in validated_data:
            instance.last_latitude = validated_data["latitude"]
        if "longitude" in validated_data:
            instance.last_longitude = validated_data["longitude"]
        instance.save()
        return instance


class RejectSOSSerializer(serializers.Serializer):
    reason = serializers.CharField(write_only=True, required=False, default="")

    def update(self, instance, validated_data):
        log_incident(instance, "incident_rejected", self.context["request"].user, validated_data.get("reason", ""))
        return instance

class IncidentMessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = IncidentMessage
        fields = ["id", "sender", "message", "created_at"]

    def create(self, validated_data):
        return IncidentMessage.objects.create(
            sos_id=self.context["sos_id"],
            sender=self.context["request"].user,
            message=validated_data["message"],
        )