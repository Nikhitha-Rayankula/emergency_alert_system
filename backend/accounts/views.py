from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import GatedSociety, Invite, CustomUser, Block, Flat
from .permissions import IsGatedSocietyAdmin, IsAdmin,IsSubAdmin, IsSubAdminOrAdmin, IsGuardian,IsGuardianOrSubAdmin
from .serializers import (
    RegisterSerializer, UpdateProfileSerializer, ProfileSerializer, GatedSocietySerializer,  RegisterViaInviteSerializer,
    InviteAdminSerializer, InviteSubAdminSerializer,
    InviteVolunteerSerializer, InviteGuardianSerializer, BlockSerializer, FlatSerializer,
    AddResidentSerializer, InviteSecuritySerializer, SendOTPSerializer, VerifyOTPSerializer
)
from django.http import HttpResponse
from django.views import View


# ---- Profile: Register / Login / Update / Delete ----

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = ProfileSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


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


class SocietyUserListView(generics.ListAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsSubAdminOrAdmin]

    def get_queryset(self):
        u = self.request.user
        if u.group.name == "Admin":
            return CustomUser.objects.all()
        return CustomUser.objects.filter(gated_society__sub_admin=u)

class SocietyUserDeleteView(generics.DestroyAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsSubAdmin]

    def get_queryset(self):
        return CustomUser.objects.filter(gated_society__sub_admin=self.request.user)


class MyGatedSocietyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.gated_society:
            return Response({"detail": "Not assigned to a society yet."}, status=404)
        return Response(GatedSocietySerializer(request.user.gated_society).data)


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

class VerifyOTPView(generics.CreateAPIView):
    serializer_class = VerifyOTPSerializer
    permission_classes = [AllowAny]