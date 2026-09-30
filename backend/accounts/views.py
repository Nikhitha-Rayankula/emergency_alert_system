from rest_framework import generics, status, serializers
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import GatedSociety, Invite, CustomUser, Block, Flat, SOSAlert, Notification, IncidentHistory, EscalationConfig, IncidentMessage
from .permissions import IsGatedSocietyAdmin, IsAdmin,IsSubAdmin, IsSubAdminOrAdmin, IsGuardian,IsGuardianOrSubAdmin, IsResident, IsSOSResponder, IsIncidentParticipant
from rest_framework.exceptions import PermissionDenied
from .serializers import (
    RegisterSerializer, UpdateProfileSerializer, ProfileSerializer, GatedSocietySerializer,  RegisterViaInviteSerializer,
    InviteAdminSerializer, InviteSubAdminSerializer,
    InviteVolunteerSerializer, InviteGuardianSerializer, BlockSerializer, FlatSerializer,
    AddResidentSerializer, InviteSecuritySerializer, SendOTPSerializer, VerifyOTPSerializer,
    ForgotPasswordSerializer,ResetPasswordSerializer,TriggerSOSSerializer, NotificationSerializer, DeviceTokenSerializer, AssignSocietySerializer,
    UpdateSOSStatusSerializer, AcceptSOSSerializer, SOSDetailSerializer, ResolveIncidentSerializer, CloseIncidentSerializer, IncidentHistorySerializer,
    EscalateSOSSerializer, EscalationConfigSerializer, AvailabilitySerializer, LocationSerializer, RejectSOSSerializer, haversine_km, IncidentMessageSerializer,
)
from django.http import HttpResponse
from django.views import View


# ---- Profile: Register / Login / Update / Delete ----

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'] = serializers.CharField(required=False, write_only=True)
        self.fields['email'] = serializers.CharField(required=False, write_only=True)

    def validate(self, attrs):
        identifier = attrs.get('email') or attrs.get('username')
        if not identifier:
            raise serializers.ValidationError({"email": "Email or username is required."})
        if '@' not in identifier:
            user = CustomUser.objects.filter(username=identifier).first()
            if user:
                attrs['email'] = user.email
            else:
                attrs['email'] = identifier
        else:
            attrs['email'] = identifier
        data = super().validate(attrs)
        data["user"] = ProfileSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]
    authentication_classes = []


class GatedSocietyListView(generics.ListAPIView):
    serializer_class = GatedSocietySerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    queryset = GatedSociety.objects.all().order_by("id")


class ProfileUpdateView(generics.UpdateAPIView):
    serializer_class = UpdateProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user  # users can only edit their own profile


class ProfileDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ProfileSerializer(request.user).data)

class AdminUserDeleteView(generics.DestroyAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAdmin]

# ---- Gated Society: Add / Edit / Delete ----

class GatedSocietyCreateView(generics.CreateAPIView):
    queryset = GatedSociety.objects.all()
    serializer_class = GatedSocietySerializer
    permission_classes = [IsGatedSocietyAdmin]


class GatedSocietyUpdateView(generics.UpdateAPIView):
    queryset = GatedSociety.objects.all()
    serializer_class = GatedSocietySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if u.group.name == "Admin":
            return GatedSociety.objects.all()
        elif u.group.name == "Sub Admin":
            return GatedSociety.objects.filter(sub_admin=u)
        return GatedSociety.objects.none()


class GatedSocietyDeleteView(generics.DestroyAPIView):
    queryset = GatedSociety.objects.all()
    serializer_class = GatedSocietySerializer
    permission_classes = [IsGatedSocietyAdmin]


## Create invite views

class InviteAdminView(generics.CreateAPIView):
    serializer_class = InviteAdminSerializer
    permission_classes = [IsAdmin]   # only Admin invites Admins

    def get_serializer_context(self):
        return {"request": self.request}


class InviteSubAdminView(generics.CreateAPIView):
    serializer_class = InviteSubAdminSerializer
    permission_classes = [IsAdmin]   # only Admin invites Sub Admins

    def get_serializer_context(self):
        return {"request": self.request}


class InviteVolunteerView(generics.CreateAPIView):
    serializer_class = InviteVolunteerSerializer
    permission_classes = [IsSubAdminOrAdmin]   # Admin or Sub Admin

    def get_serializer_context(self):
        return {"request": self.request}


class InviteGuardianView(generics.CreateAPIView):
    serializer_class = InviteGuardianSerializer
    permission_classes = [IsSubAdminOrAdmin]

    def get_serializer_context(self):
        return {"request": self.request}


# ---- Clickable link lands here: a simple HTML registration form ----

class RegisterInviteFormView(View):
    def get(self, request, token):
        try:
            invite = Invite.objects.get(token=token, is_used=False)
        except Invite.DoesNotExist:
            return HttpResponse("<h2>This invite link is invalid or already used.</h2>", status=400)

        html = f"""
        <html><body style="font-family:sans-serif;max-width:400px;margin:60px auto;">
        <h2>Complete your registration</h2>
        <p>Email: <b>{invite.email}</b> &nbsp; Role: <b>{invite.group.name}</b></p>
        <form id="regForm">
            <input type="hidden" id="token" value="{token}">
            <input type="hidden" id="email" value="{invite.email}">
            <label>Username</label><br>
            <input type="text" id="username" required style="width:100%;padding:8px;margin:6px 0;"><br>
            <label>Password</label><br>
            <input type="password" id="password" required style="width:100%;padding:8px;margin:6px 0;"><br>
            <button type="submit" style="padding:10px 20px;margin-top:10px;">Register</button>
        </form>
        <p id="result"></p>
        <script>
        document.getElementById('regForm').addEventListener('submit', async function(e) {{
            e.preventDefault();
            const res = await fetch('/api/auth/register/invite/', {{
                method: 'POST',
                headers: {{'Content-Type': 'application/json'}},
                body: JSON.stringify({{
                    token: document.getElementById('token').value,
                    email: document.getElementById('email').value,
                    username: document.getElementById('username').value,
                    password: document.getElementById('password').value
                }})
            }});
            const data = await res.json();
            document.getElementById('result').innerText = res.ok
                ? 'Registered successfully! You can now log in.'
                : JSON.stringify(data);
        }});
        </script>
        </body></html>
        """
        return HttpResponse(html)

class RegisterViaInviteView(generics.CreateAPIView):
    serializer_class = RegisterViaInviteSerializer
    permission_classes = [AllowAny]
    authentication_classes = []


class SocietyUserListView(generics.ListAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if not u.group:
            return CustomUser.objects.none()
        if u.group.name == "Admin":
            return CustomUser.objects.all().order_by("-id")
        if u.group.name == "Sub Admin":
            managed = GatedSociety.objects.filter(sub_admin=u).first()
            if managed:
                return CustomUser.objects.filter(gated_society=managed).order_by("-id")
            if u.gated_society:
                return CustomUser.objects.filter(gated_society=u.gated_society).order_by("-id")
            return CustomUser.objects.none()
        if u.group.name == "Guardian":
            if u.flat:
                return CustomUser.objects.filter(flat=u.flat).order_by("-id")
            if u.gated_society:
                return CustomUser.objects.filter(gated_society=u.gated_society).order_by("-id")
            return CustomUser.objects.none()
        if u.gated_society:
            return CustomUser.objects.filter(gated_society=u.gated_society).order_by("-id")
        return CustomUser.objects.none()

class SocietyUserDeleteView(generics.DestroyAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsSubAdmin]

    def get_queryset(self):
        return CustomUser.objects.filter(gated_society__sub_admin=self.request.user)


class MyGatedSocietyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        society = None
        if user.gated_society:
            society = user.gated_society
        elif user.group and user.group.name == "Sub Admin":
            society = GatedSociety.objects.filter(sub_admin=user).first()
        elif user.group and user.group.name == "Admin":
            society_id = request.query_params.get("society_id")
            if society_id:
                society = GatedSociety.objects.filter(id=society_id).first()
            if not society:
                society = GatedSociety.objects.first()

        if not society:
            return Response({"detail": "Not assigned to a society yet."}, status=404)
        return Response(GatedSocietySerializer(society).data)


class BlockCreateView(generics.CreateAPIView):
    queryset = Block.objects.all()
    serializer_class = BlockSerializer
    permission_classes = [IsSubAdminOrAdmin]

    def perform_create(self, serializer):
        u = self.request.user
        if u.group.name == "Sub Admin":
            society = GatedSociety.objects.filter(sub_admin=u).first()
            serializer.save(gated_society=society)
        else:
            serializer.save()


class BlockListView(generics.ListAPIView):
    serializer_class = BlockSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Block.objects.filter(gated_society_id=self.kwargs["society_id"])


class FlatCreateView(generics.CreateAPIView):
    queryset = Flat.objects.all()
    serializer_class = FlatSerializer
    permission_classes = [IsSubAdminOrAdmin]


class FlatListView(generics.ListAPIView):
    serializer_class = FlatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Flat.objects.filter(block_id=self.kwargs["block_id"])


class AddResidentView(generics.CreateAPIView):
    serializer_class = AddResidentSerializer
    permission_classes = [IsGuardianOrSubAdmin]

    def get_serializer_context(self):
        return {"request": self.request}


class InviteSecurityView(generics.CreateAPIView):
    serializer_class = InviteSecuritySerializer
    permission_classes = [IsSubAdminOrAdmin]

    def get_serializer_context(self):
        return {"request": self.request}



class SendOTPView(generics.CreateAPIView):
    serializer_class = SendOTPSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Verification code sent to your email."}, status=status.HTTP_200_OK)

class VerifyOTPView(generics.CreateAPIView):
    serializer_class = VerifyOTPSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)


class ForgotPasswordView(generics.CreateAPIView):
    serializer_class = ForgotPasswordSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_serializer_context(self):
        return {"request": self.request}

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)


class ResetPasswordView(generics.CreateAPIView):
    serializer_class = ResetPasswordSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_serializer_context(self):
        return {"request": self.request}

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)


class TriggerSOSView(generics.CreateAPIView):
    serializer_class = TriggerSOSSerializer
    permission_classes = [IsResident]

    def get_serializer_context(self):
        return {"request": self.request}


class SOSListView(generics.ListAPIView):
    serializer_class = TriggerSOSSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SOSAlert.objects.filter(user=self.request.user).order_by("-created_at")


class AllIncidentsListView(generics.ListAPIView):
    serializer_class = TriggerSOSSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if not u.group:
            return SOSAlert.objects.filter(user=u).order_by("-created_at")
        if u.group.name == "Admin":
            return SOSAlert.objects.all().order_by("-created_at")
        if u.group.name == "Sub Admin":
            managed = GatedSociety.objects.filter(sub_admin=u).first()
            if managed:
                return SOSAlert.objects.filter(user__gated_society=managed).order_by("-created_at")
            if u.gated_society:
                return SOSAlert.objects.filter(user__gated_society=u.gated_society).order_by("-created_at")
            return SOSAlert.objects.filter(user=u).order_by("-created_at")
        if u.group.name in ["Volunteer", "Security"]:
            if u.gated_society:
                return SOSAlert.objects.filter(user__gated_society=u.gated_society).order_by("-created_at")
            return SOSAlert.objects.all().order_by("-created_at")
        if u.group.name == "Guardian":
            if u.flat:
                return SOSAlert.objects.filter(user__flat=u.flat).order_by("-created_at")
            if u.gated_society:
                return SOSAlert.objects.filter(user__gated_society=u.gated_society).order_by("-created_at")
            return SOSAlert.objects.filter(user=u).order_by("-created_at")
        return SOSAlert.objects.filter(user=u).order_by("-created_at")


class MyNotificationsView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by("-created_at")


class MarkNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        notif.is_read = True
        notif.save()
        return Response({"detail": "Marked as read."})


class RegisterDeviceTokenView(generics.CreateAPIView):
    serializer_class = DeviceTokenSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        return {"request": self.request}



class AssignSocietyView(generics.CreateAPIView):
    serializer_class = AssignSocietySerializer
    permission_classes = [IsSubAdminOrAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_201_CREATED)

class UpdateSOSStatusView(generics.UpdateAPIView):
    queryset = SOSAlert.objects.all()
    serializer_class = UpdateSOSStatusSerializer
    permission_classes = [IsSOSResponder]

class SOSNotificationsView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsSubAdminOrAdmin]

    def get_queryset(self):
        sos = SOSAlert.objects.filter(id=self.kwargs["sos_id"]).first()
        if not sos:
            return Notification.objects.none()

        u = self.request.user
        if u.group.name == "Admin":
            return Notification.objects.filter(sos_id=self.kwargs["sos_id"])

        # Sub Admin only sees notifications for SOS incidents within their own society
        if sos.user.gated_society and sos.user.gated_society.sub_admin == u:
            return Notification.objects.filter(sos_id=self.kwargs["sos_id"])

        return Notification.objects.none()


class AcceptSOSView(generics.UpdateAPIView):
    queryset = SOSAlert.objects.all()
    serializer_class = AcceptSOSSerializer
    permission_classes = [IsSOSResponder]

    def get_serializer_context(self):
        return {"request": self.request}


class SOSDetailView(generics.RetrieveAPIView):
    serializer_class = SOSDetailSerializer
    permission_classes = [IsIncidentParticipant]

    def get_queryset(self):
        qs = SOSAlert.objects.all()
        if self.request.user.group.name == "Resident":
            qs = qs.filter(user=self.request.user)
        return qs

class ResolveIncidentView(generics.UpdateAPIView):
    queryset = SOSAlert.objects.all()
    serializer_class = ResolveIncidentSerializer
    permission_classes = [IsSOSResponder]
    def get_serializer_context(self):
        return {"request": self.request}


class CloseIncidentView(generics.UpdateAPIView):
    queryset = SOSAlert.objects.all()
    serializer_class = CloseIncidentSerializer
    permission_classes = [IsSubAdminOrAdmin]
    def get_serializer_context(self):
        return {"request": self.request}


class IncidentHistoryView(generics.ListAPIView):
    serializer_class = IncidentHistorySerializer
    permission_classes = [IsIncidentParticipant]

    def get_queryset(self):
        qs = IncidentHistory.objects.filter(sos_id=self.kwargs["pk"]).order_by("created_at")
        if self.request.user.group.name == "Resident":
            qs = qs.filter(sos__user=self.request.user)
        return qs

class EscalateIncidentView(generics.UpdateAPIView):
    queryset = SOSAlert.objects.all()
    serializer_class = EscalateSOSSerializer
    permission_classes = [IsSOSResponder]
    def get_serializer_context(self):
        return {"request": self.request}


class EscalationConfigView(generics.RetrieveUpdateAPIView):
    serializer_class = EscalationConfigSerializer
    permission_classes = [IsSubAdminOrAdmin]

    def get_object(self):
        u = self.request.user
        society = None
        if u.group and u.group.name == "Admin":
            society_id = self.request.query_params.get("society_id")
            if society_id:
                society = GatedSociety.objects.filter(id=society_id).first()
            if not society:
                society = GatedSociety.objects.first()
        elif u.group and u.group.name == "Sub Admin":
            society = GatedSociety.objects.filter(sub_admin=u).first() or u.gated_society

        if not society:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("No gated society found for escalation rules configuration.")
        config, _ = EscalationConfig.objects.get_or_create(gated_society=society)
        return config


class UpdateAvailabilityView(generics.UpdateAPIView):
    serializer_class = AvailabilitySerializer
    permission_classes = [IsAuthenticated]
    def get_object(self):
        return self.request.user
    def get_serializer_context(self):
        return {"request": self.request}


class UpdateMyLocationView(generics.UpdateAPIView):
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated]
    def get_object(self):
        return self.request.user
    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Location updated successfully."})


class RejectSOSView(generics.UpdateAPIView):
    queryset = SOSAlert.objects.all()
    serializer_class = RejectSOSSerializer
    permission_classes = [IsSOSResponder]
    def get_serializer_context(self):
        return {"request": self.request}


class NearbyIncidentsView(APIView):
    permission_classes = [IsSOSResponder]

    def get(self, request):
        lat = float(request.query_params.get("latitude"))
        lon = float(request.query_params.get("longitude"))
        radius = float(request.query_params.get("radius", 2000)) / 1000  # meters -> km

        open_incidents = SOSAlert.objects.filter(status="open")
        nearby = []
        for sos in open_incidents:
            dist = haversine_km(lat, lon, sos.latitude, sos.longitude)
            if dist * 1000 <= float(request.query_params.get("radius", 2000)):
                data = SOSDetailSerializer(sos).data
                data["distance_meters"] = round(dist * 1000)
                nearby.append(data)
        return Response(sorted(nearby, key=lambda x: x["distance_meters"]))


class ResponderAssignmentView(generics.UpdateAPIView):
    queryset = SOSAlert.objects.all()
    permission_classes = [IsSubAdminOrAdmin]
    serializer_class = AcceptSOSSerializer  # reuses accept logic, but triggered by admin on someone's behalf

class IncidentChatView(generics.ListCreateAPIView):
    serializer_class = IncidentMessageSerializer
    permission_classes = [IsIncidentParticipant]

    def get_queryset(self):
        qs = IncidentMessage.objects.filter(sos_id=self.kwargs["pk"]).order_by("created_at")
        if self.request.user.group.name == "Resident":
            qs = qs.filter(sos__user=self.request.user)
        return qs

    def get_serializer_context(self):
        return {"request": self.request, "sos_id": self.kwargs["pk"]}

    def perform_create(self, serializer):
        u = self.request.user
        if u.group.name == "Resident" and not SOSAlert.objects.filter(id=self.kwargs["pk"], user=u).exists():
            raise PermissionDenied("This is not your incident.")
        serializer.save()