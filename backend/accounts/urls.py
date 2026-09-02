from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, LoginView, MeView, ProfileUpdateView, ProfileDeleteView,
    GatedSocietyCreateView, GatedSocietyUpdateView, GatedSocietyDeleteView,
    InviteAdminView, InviteSubAdminView, InviteVolunteerView, InviteGuardianView,
    RegisterInviteFormView, RegisterViaInviteView, BlockCreateView, BlockListView, FlatCreateView, FlatListView,
    MyGatedSocietyView, SocietyUserListView, SocietyUserDeleteView,AdminUserDeleteView,
    AddResidentView, InviteSecurityView, SendOTPView, VerifyOTPView,
)

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("login/refresh/", TokenRefreshView.as_view()),
    path("me/", MeView.as_view()),
    path("profile/update/", ProfileUpdateView.as_view()),
    path("profile/delete/", ProfileDeleteView.as_view()),
    path("admin/users/<int:pk>/delete/", AdminUserDeleteView.as_view()),

    path("gated-society/add/", GatedSocietyCreateView.as_view()),
    path("gated-society/<int:pk>/edit/", GatedSocietyUpdateView.as_view()),
    path("gated-society/<int:pk>/delete/", GatedSocietyDeleteView.as_view()),
    path("gated-society/mine/", MyGatedSocietyView.as_view()),

    path("invite/admin/", InviteAdminView.as_view()),
    path("invite/subadmin/", InviteSubAdminView.as_view()),
    path("invite/volunteer/", InviteVolunteerView.as_view()),
    path("invite/guardian/", InviteGuardianView.as_view()),
    path("invite/security/", InviteSecurityView.as_view()),

    path("register/invite/<str:token>/", RegisterInviteFormView.as_view()),  # clickable link lands here
    path("register/invite/", RegisterViaInviteView.as_view()),               # form submits here

    
    path("society/users/", SocietyUserListView.as_view()),
    path("society/users/<int:pk>/delete/", SocietyUserDeleteView.as_view()),

    path("societies/<int:society_id>/blocks/", BlockListView.as_view()),
    path("blocks/add/", BlockCreateView.as_view()),
    path("blocks/<int:block_id>/flats/", FlatListView.as_view()),
    path("flats/add/", FlatCreateView.as_view()),

    path("add-resident/", AddResidentView.as_view()),

    path("send-otp/", SendOTPView.as_view()),
    path("verify-otp/", VerifyOTPView.as_view()),
]