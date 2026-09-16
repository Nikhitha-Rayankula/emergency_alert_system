from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from rest_framework import serializers
from .models import CustomUser, GatedSociety, Invite, Block, Flat, OTP, SOSAlert, Notification, DeviceToken
from django.core.mail import send_mail
from django.conf import settings
from twilio.rest import Client
from .firebase import send_push_notification

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            "id", "username", "email", "mobile", "first_name", "last_name",
            "emergency_contact1", "emergency_contact2", "emergency_contact3",
            "gated_society", "group",
        ]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    group_name = serializers.ChoiceField(choices=["Volunteer", "Guardian", "Resident"], write_only=True)
    gated_society = serializers.PrimaryKeyRelatedField(queryset=GatedSociety.objects.all(), required=False)
    flat = serializers.PrimaryKeyRelatedField(queryset=Flat.objects.all(), required=False)

    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "password", "mobile",
                  "emergency_contact1", "emergency_contact2", "emergency_contact3", "group_name", "gated_society", "flat",]

    def validate(self, attrs):
        if attrs.get("group_name") == "Resident":
            if not attrs.get("gated_society"):
                raise serializers.ValidationError({"gated_society": "This field is required for Residents."})
            if not attrs.get("flat"):
                raise serializers.ValidationError({"flat": "This field is required for Residents."})
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

def send_sms(to_number, body):
    if not to_number:
        return
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(body=body, from_=settings.TWILIO_PHONE_NUMBER, to=to_number)
    except Exception as e:
        print(f"SMS failed: {e}")

def send_invite_email(invite):
    link = f"{settings.FRONTEND_BASE_URL}/api/auth/register/invite/{invite.token}/"
    send_mail(
        subject="You're invited to join Emergency Response Platform",
        message=f"Click the link to complete your registration:\n\n{link}",
        from_email=None,
        recipient_list=[invite.email],
    )


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
            raise serializers.ValidationError("Invalid OTP.")
        if not otp_obj.is_valid():
            raise serializers.ValidationError("OTP expired or already used.")
        otp_obj.is_used = True
        otp_obj.save()
        CustomUser.objects.filter(email=attrs["email"]).update(is_active=True)
        return attrs

    def create(self, validated_data):
        return validated_data


class ForgotPasswordSerializer(serializers.Serializer):
    def create(self, validated_data):
        user = self.context["request"].user
        otp = OTP.generate(user.email, "forgot_password")
        send_mail(
            "Password Reset Code",
            f"Your password reset code is {otp.code}. It expires in 5 minutes.",
            None,
            [user.email],
        )
        return {"detail": "Password reset code sent to your email."}


class ResetPasswordSerializer(serializers.Serializer):
    otp = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        user = self.context["request"].user
        try:
            otp_obj = OTP.objects.filter(
                email=user.email, code=attrs["otp"], purpose="forgot_password"
            ).latest("created_at")
        except OTP.DoesNotExist:
            raise serializers.ValidationError("Invalid OTP.")
        if not otp_obj.is_valid():
            raise serializers.ValidationError("OTP expired or already used.")
        attrs["otp_obj"] = otp_obj
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
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



def notify_user(sos, recipient):
    title = f"Emergency Alert: {sos.get_category_display()}"
    body = f"{sos.user.username} needs help.\nLocation: {sos.latitude}, {sos.longitude}\n{sos.message}"

    notif = Notification.objects.create(recipient=recipient, title=title, message=body, sos=sos)

    try:
        send_mail(subject=title, message=body, from_email=None, recipient_list=[recipient.email])
        notif.email_delivered = True
    except Exception as e:
        print(f"Email failed for {recipient.username}: {e}")

    if recipient.mobile:
        try:
            send_sms(recipient.mobile, f"{title}\n{body}")
            notif.sms_delivered = True
        except Exception as e:
            print(f"SMS failed for {recipient.username}: {e}")

    for dt in DeviceToken.objects.filter(user=recipient):
        result = send_push_notification(dt.token, title, body)
        if result:
            notif.push_delivered = True

    notif.save()



def route_sos_notifications(sos):
    user = sos.user
    notified = set()

    # 1. Primary Guardian
    if user.flat and user.flat.guardian and user.flat.guardian != user:
        notify_user(sos, user.flat.guardian)
        notified.add(user.flat.guardian.id)

    if user.gated_society:
        # 2. Sub Admin (society manager)
        if user.gated_society.sub_admin and user.gated_society.sub_admin.id not in notified:
            notify_user(sos, user.gated_society.sub_admin)
            notified.add(user.gated_society.sub_admin.id)

        # 3. Security personnel
        security_group = Group.objects.filter(name="Security").first()
        if security_group:
            for staff in CustomUser.objects.filter(gated_society=user.gated_society, group=security_group):
                if staff.id not in notified:
                    notify_user(sos, staff)
                    notified.add(staff.id)

        # 4. Volunteers
        volunteer_group = Group.objects.filter(name="Volunteer").first()
        if volunteer_group:
            for vol in CustomUser.objects.filter(gated_society=user.gated_society, group=volunteer_group):
                if vol.id not in notified:
                    notify_user(sos, vol)
                    notified.add(vol.id)

        # 5. Community Broadcast — notify all Residents in the same society (excluding the triggering user)
        if user.gated_society:
            resident_group = Group.objects.filter(name="Resident").first()
            if resident_group:
                for res in CustomUser.objects.filter(gated_society=user.gated_society, group=resident_group).exclude(id=user.id):
                    if res.id not in notified:
                        notify_user(sos, res)
                        notified.add(res.id)

    return notified


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
        return instance

class SOSDetailSerializer(serializers.ModelSerializer):
    responder = serializers.StringRelatedField()

    class Meta:
        model = SOSAlert
        fields = ["id", "category", "message", "latitude", "longitude", "status", "responder", "created_at", "resolved_at"]