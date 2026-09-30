from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, LoginView, MeView, ProfileUpdateView, ProfileDeleteView,
    GatedSocietyCreateView, GatedSocietyUpdateView, GatedSocietyDeleteView, GatedSocietyListView,
    InviteAdminView, InviteSubAdminView, InviteVolunteerView, InviteGuardianView,
    RegisterInviteFormView, RegisterViaInviteView, BlockCreateView, BlockListView, FlatCreateView, FlatListView,
    MyGatedSocietyView, SocietyUserListView, SocietyUserDeleteView,AdminUserDeleteView,
    AddResidentView, InviteSecurityView, SendOTPView, VerifyOTPView, ForgotPasswordView, ResetPasswordView, TriggerSOSView,
    SOSListView, AllIncidentsListView, MarkNotificationReadView,MyNotificationsView, RegisterDeviceTokenView,
    AssignSocietyView, SOSNotificationsView, AcceptSOSView, SOSDetailView, UpdateSOSStatusView, ResolveIncidentView, CloseIncidentView, IncidentHistoryView,
    EscalateIncidentView, EscalationConfigView, UpdateAvailabilityView, UpdateMyLocationView, RejectSOSView, NearbyIncidentsView, IncidentChatView
)

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("login/refresh/", TokenRefreshView.as_view()),
    path("me/", MeView.as_view()),
    path("profile/update/", ProfileUpdateView.as_view()),
    path("profile/delete/", ProfileDeleteView.as_view()),
    path("admin/users/<int:pk>/delete/", AdminUserDeleteView.as_view()),

    path("gated-society/", GatedSocietyListView.as_view()),
    path("gated-societies/", GatedSocietyListView.as_view()),
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

    path("assign-society/", AssignSocietyView.as_view()),
    
    path("society/users/", SocietyUserListView.as_view()),
    path("society/users/<int:pk>/delete/", SocietyUserDeleteView.as_view()),

    path("societies/<int:society_id>/blocks/", BlockListView.as_view()),
    path("blocks/add/", BlockCreateView.as_view()),
    path("blocks/<int:block_id>/flats/", FlatListView.as_view()),
    path("flats/add/", FlatCreateView.as_view()),

    path("add-resident/", AddResidentView.as_view()),

    path("send-otp/", SendOTPView.as_view()),
    path("verify-otp/", VerifyOTPView.as_view()),

    path("forgot-password/", ForgotPasswordView.as_view()),
    path("reset-password/", ResetPasswordView.as_view()),

    path("sos/trigger/", TriggerSOSView.as_view()),
    path("sos/mine/", SOSListView.as_view()),
    path("sos/all/", AllIncidentsListView.as_view()),
    path("incidents/all/", AllIncidentsListView.as_view()),

    path("notifications/", MyNotificationsView.as_view()),
    path("notifications/<int:pk>/read/", MarkNotificationReadView.as_view()),

    path("device-token/register/", RegisterDeviceTokenView.as_view()),

    path("sos/<int:sos_id>/notifications/", SOSNotificationsView.as_view()),

    path("sos/<int:pk>/accept/", AcceptSOSView.as_view()),

    path("sos/<int:pk>/", SOSDetailView.as_view()),
    path("sos/<int:pk>/status/", UpdateSOSStatusView.as_view()),

    path("sos/<int:pk>/resolve/", ResolveIncidentView.as_view()),
    path("sos/<int:pk>/close/", CloseIncidentView.as_view()),
    path("sos/<int:pk>/history/", IncidentHistoryView.as_view()),

    path("incidents/<int:pk>/escalate/", EscalateIncidentView.as_view()),
    path("escalation/config/", EscalationConfigView.as_view()),

    path("responders/me/availability/", UpdateAvailabilityView.as_view()),
    path("users/me/location/", UpdateMyLocationView.as_view()),
    path("incidents/<int:pk>/reject/", RejectSOSView.as_view()),
    path("responders/incidents/nearby/", NearbyIncidentsView.as_view()),

    path("incidents/<int:pk>/chat/messages/", IncidentChatView.as_view()),
]