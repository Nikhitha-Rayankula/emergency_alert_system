from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from rest_framework import serializers
from .models import CustomUser, GatedSociety, Invite, Block, Flat, OTP
from django.core.mail import send_mail
from django.conf import settings

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


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data["username"], password=data["password"])
        if not user:
            raise serializers.ValidationError("Invalid username or password.")
        data["user"] = user
        return data


class GatedSocietySerializer(serializers.ModelSerializer):
    class Meta:
        model = GatedSociety
        fields = ["id", "society_name", "owner_name", "incharge", "sub_admin", "created_at", "updated_at"]


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
        group, _ = Group.objects.get_or_create(name="Security")
        society = GatedSociety.objects.filter(sub_admin=request_user).first()
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