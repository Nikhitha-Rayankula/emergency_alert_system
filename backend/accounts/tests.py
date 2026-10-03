from django.test import TestCase
from django.contrib.auth.models import Group
from rest_framework.test import APIClient
from rest_framework import status
from .models import (
    CustomUser, GatedSociety, Block, Flat, OTP, SOSAlert, Invite,
    Notification, IncidentHistory, EscalationConfig, IncidentMessage
)


class BaseTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create standard groups
        self.admin_group, _ = Group.objects.get_or_create(name="Admin")
        self.subadmin_group, _ = Group.objects.get_or_create(name="Sub Admin")
        self.guardian_group, _ = Group.objects.get_or_create(name="Guardian")
        self.volunteer_group, _ = Group.objects.get_or_create(name="Volunteer")
        self.security_group, _ = Group.objects.get_or_create(name="Security")
        self.resident_group, _ = Group.objects.get_or_create(name="Resident")

        # Create Platform Admin
        self.admin = CustomUser.objects.create_user(
            username="platform_admin",
            email="admin@cerp.test",
            password="AdminPassword123!",
            group=self.admin_group,
            is_active=True,
        )

        # Create Society 1
        self.society1 = GatedSociety.objects.create(
            society_name="Green Valley Residency",
            owner_name="Mr. Sharma",
            incharge="Rahul Verma",
        )

        # Create SubAdmin for Society 1
        self.subadmin1 = CustomUser.objects.create_user(
            username="subadmin_gvr",
            email="subadmin1@cerp.test",
            password="SubAdminPass123!",
            group=self.subadmin_group,
            gated_society=self.society1,
            is_active=True,
        )
        self.society1.sub_admin = self.subadmin1
        self.society1.save()

        # Create Block & Flat under Society 1
        self.block1 = Block.objects.create(
            gated_society=self.society1,
            name="Block A",
            code="A",
        )
        self.flat1 = Flat.objects.create(
            block=self.block1,
            flat_number="302",
            floor=3,
            flat_type="3BHK",
        )

        # Create Guardian for Flat 1
        self.guardian = CustomUser.objects.create_user(
            username="guardian_302",
            email="guardian@cerp.test",
            password="GuardianPass123!",
            group=self.guardian_group,
            gated_society=self.society1,
            flat=self.flat1,
            is_active=True,
        )
        self.flat1.guardian = self.guardian
        self.flat1.save()

        # Create Resident in Flat 1
        self.resident = CustomUser.objects.create_user(
            username="resident_rahul",
            email="rahul@cerp.test",
            password="ResidentPass123!",
            group=self.resident_group,
            gated_society=self.society1,
            flat=self.flat1,
            is_active=True,
        )

        # Create Volunteer in Society 1
        self.volunteer = CustomUser.objects.create_user(
            username="volunteer_amit",
            email="volunteer@cerp.test",
            password="VolunteerPass123!",
            group=self.volunteer_group,
            gated_society=self.society1,
            is_active=True,
            last_latitude=12.971600,
            last_longitude=77.594600,
        )


class TestAuthenticationAndRegistration(BaseTestCase):
    def test_user_registration_and_otp_verification(self):
        # 1. Register new resident
        reg_payload = {
            "username": "new_resident",
            "email": "newres@test.com",
            "password": "Password123!",
            "mobile": "+919876543210",
            "group_name": "Resident",
            "gated_society": self.society1.id,
            "flat": self.flat1.id,
        }
        res = self.client.post("/api/auth/register/", reg_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        user = CustomUser.objects.get(email="newres@test.com")
        self.assertFalse(user.is_active)

        # 2. OTP generated
        otp = OTP.objects.filter(email="newres@test.com", purpose="registration").latest("created_at")
        self.assertTrue(otp.is_valid())

        # 3. Verify OTP
        verify_res = self.client.post("/api/auth/verify-otp/", {
            "email": "newres@test.com",
            "otp": otp.code
        }, format="json")
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)

        user.refresh_from_db()
        self.assertTrue(user.is_active)

    def test_login_and_me_profile_hierarchy(self):
        # Login resident
        login_res = self.client.post("/api/auth/login/", {
            "email": "rahul@cerp.test",
            "password": "ResidentPass123!"
        }, format="json")
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        token = login_res.data["access"]

        # Authenticate with JWT
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me_res = self.client.get("/api/auth/me/")
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        data = me_res.data

        # Verify ID and organization hierarchy fields
        self.assertEqual(data["username"], "resident_rahul")
        self.assertEqual(data["group_name"], "Resident")
        self.assertEqual(data["gated_society"], self.society1.id)
        self.assertEqual(data["society_name"], "Green Valley Residency")
        self.assertEqual(data["flat_id"], self.flat1.id)
        self.assertEqual(data["flat_number"], "302")
        self.assertEqual(data["block_id"], self.block1.id)
        self.assertEqual(data["block_name"], "Block A")

    def test_forgot_and_reset_password(self):
        # Request reset OTP
        send_res = self.client.post("/api/auth/send-otp/", {
            "email": "rahul@cerp.test",
            "purpose": "forgot_password"
        }, format="json")
        self.assertEqual(send_res.status_code, status.HTTP_200_OK)

        otp = OTP.objects.filter(email="rahul@cerp.test", purpose="forgot_password").latest("created_at")

        # Reset password
        reset_res = self.client.post("/api/auth/reset-password/", {
            "email": "rahul@cerp.test",
            "otp": otp.code,
            "new_password": "NewSecretPassword123!"
        }, format="json")
        self.assertEqual(reset_res.status_code, status.HTTP_200_OK)

        # Verify login with new password
        login_res = self.client.post("/api/auth/login/", {
            "email": "rahul@cerp.test",
            "password": "NewSecretPassword123!"
        }, format="json")
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)


class TestSocietyBlockFlatIntegrity(BaseTestCase):
    def test_society_block_flat_crud_and_parent_links(self):
        self.client.force_authenticate(user=self.admin)

        # 1. Create Society
        soc_res = self.client.post("/api/auth/gated-society/add/", {
            "society_name": "Sunrise Heights",
            "owner_name": "Anil Kapoor",
            "incharge": "Vikram Seth"
        }, format="json")
        self.assertEqual(soc_res.status_code, status.HTTP_201_CREATED)
        new_soc_id = soc_res.data["id"]

        # 2. Create Block under new society
        blk_res = self.client.post("/api/auth/blocks/add/", {
            "gated_society": new_soc_id,
            "name": "Tower B",
            "code": "B"
        }, format="json")
        self.assertEqual(blk_res.status_code, status.HTTP_201_CREATED)
        new_blk_id = blk_res.data["id"]
        self.assertEqual(blk_res.data["society_name"], "Sunrise Heights")

        # 3. Create Flat under new block
        flt_res = self.client.post("/api/auth/flats/add/", {
            "block": new_blk_id,
            "flat_number": "501",
            "floor": 5,
            "flat_type": "2BHK"
        }, format="json")
        self.assertEqual(flt_res.status_code, status.HTTP_201_CREATED)
        new_flt_id = flt_res.data["id"]
        self.assertEqual(flt_res.data["block_name"], "Tower B")
        self.assertEqual(flt_res.data["society_id"], new_soc_id)
        self.assertEqual(flt_res.data["society_name"], "Sunrise Heights")

        # 4. List blocks for society
        blocks_list = self.client.get(f"/api/auth/societies/{new_soc_id}/blocks/")
        self.assertEqual(blocks_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(blocks_list.data), 1)
        self.assertEqual(blocks_list.data[0]["id"], new_blk_id)

        # 5. List flats for block
        flats_list = self.client.get(f"/api/auth/blocks/{new_blk_id}/flats/")
        self.assertEqual(flats_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(flats_list.data), 1)
        self.assertEqual(flats_list.data[0]["id"], new_flt_id)
        self.assertEqual(flats_list.data[0]["flat_number"], "501")


class TestRoleBasedSecurityAndAccess(BaseTestCase):
    def test_resident_cannot_create_society_or_block(self):
        self.client.force_authenticate(user=self.resident)

        # Try create society
        res1 = self.client.post("/api/auth/gated-society/add/", {
            "society_name": "Unauthorized Society",
            "owner_name": "Hacker",
            "incharge": "Hacker"
        }, format="json")
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)

        # Try create block
        res2 = self.client.post("/api/auth/blocks/add/", {
            "gated_society": self.society1.id,
            "name": "Unauthorized Block",
            "code": "U"
        }, format="json")
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

    def test_subadmin_isolation(self):
        # Create Society 2 and SubAdmin 2
        society2 = GatedSociety.objects.create(
            society_name="Silver Oak Enclave",
            owner_name="Owner 2",
            incharge="Incharge 2"
        )
        subadmin2 = CustomUser.objects.create_user(
            username="subadmin_silver",
            email="subadmin2@cerp.test",
            password="SubPass123!",
            group=self.subadmin_group,
            gated_society=society2,
            is_active=True
        )
        society2.sub_admin = subadmin2
        society2.save()

        # Subadmin 1 tries to edit Society 2
        self.client.force_authenticate(user=self.subadmin1)
        res = self.client.patch(f"/api/auth/gated-society/{society2.id}/edit/", {
            "society_name": "Tampered Society"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


class TestInvitationsAndDeepLinking(BaseTestCase):
    def test_invitation_creation_token_validation_and_registration(self):
        self.client.force_authenticate(user=self.subadmin1)

        # 1. SubAdmin invites a Guardian to Flat 1
        inv_res = self.client.post("/api/auth/invite/guardian/", {
            "email": "newguardian@cerp.test",
            "flat": self.flat1.id
        }, format="json")
        self.assertEqual(inv_res.status_code, status.HTTP_201_CREATED)

        invite = Invite.objects.get(email="newguardian@cerp.test")
        token = invite.token
        self.assertFalse(invite.is_used)

        # 2. Validate token endpoint (JSON request simulating mobile app)
        self.client.force_authenticate(user=None)
        val_res = self.client.get(
            f"/api/auth/register/invite/{token}/",
            HTTP_ACCEPT="application/json"
        )
        self.assertEqual(val_res.status_code, status.HTTP_200_OK)
        val_data = val_res.json()
        self.assertTrue(val_data["valid"])
        self.assertEqual(val_data["email"], "newguardian@cerp.test")
        self.assertEqual(val_data["role"], "Guardian")
        self.assertEqual(val_data["society_id"], self.society1.id)
        self.assertEqual(val_data["society_name"], "Green Valley Residency")
        self.assertEqual(val_data["flat_id"], self.flat1.id)
        self.assertEqual(val_data["flat_number"], "302")

        # 3. Register via invite
        reg_invite_res = self.client.post("/api/auth/register/invite/", {
            "token": token,
            "email": "newguardian@cerp.test",
            "username": "guardian_priya",
            "password": "StrongPassword123!",
            "mobile": "+919876543219"
        }, format="json")
        self.assertEqual(reg_invite_res.status_code, status.HTTP_201_CREATED)

        # 4. Verify user was created with correct role & flat
        new_user = CustomUser.objects.get(username="guardian_priya")
        self.assertEqual(new_user.group.name, "Guardian")
        self.assertEqual(new_user.gated_society_id, self.society1.id)
        self.assertEqual(new_user.flat_id, self.flat1.id)

        # 5. Token is now marked used and cannot be reused
        invite.refresh_from_db()
        self.assertTrue(invite.is_used)

        reuse_res = self.client.get(
            f"/api/auth/register/invite/{token}/",
            HTTP_ACCEPT="application/json"
        )
        self.assertEqual(reuse_res.status_code, status.HTTP_400_BAD_REQUEST)


from django.test import TestCase, override_settings


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class TestSOSAlertLifecycleAndChat(BaseTestCase):
    def test_full_sos_lifecycle(self):
        # 1. Resident triggers SOS
        self.client.force_authenticate(user=self.resident)
        trigger_res = self.client.post("/api/auth/sos/trigger/", {
            "category": "medical",
            "message": "Severe chest pain, need immediate medical assistance",
            "latitude": "12.971598",
            "longitude": "77.594562",
        }, format="json")
        self.assertEqual(trigger_res.status_code, status.HTTP_201_CREATED)
        sos_id = trigger_res.data["id"]
        self.assertEqual(trigger_res.data["status"], "open")
        self.assertEqual(trigger_res.data["society_name"], "Green Valley Residency")
        self.assertEqual(trigger_res.data["flat_number"], "302")

        # 2. Notification was created for Guardian and Volunteer
        notifs = Notification.objects.filter(sos_id=sos_id)
        self.assertGreater(notifs.count(), 0)

        # 3. Volunteer accepts SOS
        self.client.force_authenticate(user=self.volunteer)
        accept_res = self.client.patch(f"/api/auth/sos/{sos_id}/accept/", {}, format="json")
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)

        # 4. Check SOS detail
        detail_res = self.client.get(f"/api/auth/sos/{sos_id}/")
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        d = detail_res.data
        self.assertEqual(d["status"], "active_response")
        self.assertEqual(d["responder_name"], "volunteer_amit")
        self.assertEqual(d["society_name"], "Green Valley Residency")
        self.assertEqual(d["flat_number"], "302")

        # 5. Volunteer sends incident chat message
        msg_res = self.client.post(f"/api/auth/incidents/{sos_id}/chat/messages/", {
            "message": "I am on my way with first-aid kit. ETA 3 mins."
        }, format="json")
        self.assertEqual(msg_res.status_code, status.HTTP_201_CREATED)

        # 6. Volunteer resolves incident
        resolve_res = self.client.patch(f"/api/auth/sos/{sos_id}/resolve/", {
            "resolution": "Resident attended by first responder and doctor."
        }, format="json")
        self.assertEqual(resolve_res.status_code, status.HTTP_200_OK)

        # 7. SubAdmin closes incident
        self.client.force_authenticate(user=self.subadmin1)
        close_res = self.client.patch(f"/api/auth/sos/{sos_id}/close/", {
            "closure_note": "Incident closed and documented."
        }, format="json")
        self.assertEqual(close_res.status_code, status.HTTP_200_OK)

        # 8. Check incident history timeline
        hist_res = self.client.get(f"/api/auth/sos/{sos_id}/history/")
        self.assertEqual(hist_res.status_code, status.HTTP_200_OK)
        actions = [h["action"] for h in hist_res.data]
        self.assertIn("incident_created", actions)
        self.assertIn("incident_accepted", actions)
        self.assertIn("incident_resolved", actions)
        self.assertIn("incident_closed", actions)
