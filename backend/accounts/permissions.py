from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Only users in the 'Admin' group."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and u.group and u.group.name == "Admin")


class IsSubAdmin(BasePermission):
    """Only users in the 'Sub Admin' group."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and u.group and u.group.name == "Sub Admin")


class IsSubAdminOrAdmin(BasePermission):
    """Users in either the 'Sub Admin' or 'Admin' group."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and u.group and u.group.name in ["Sub Admin", "Admin"])


class IsVolunteer(BasePermission):
    """Only users in the 'Volunteer' group."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and u.group and u.group.name == "Volunteer")


class IsGuardian(BasePermission):
    """Only users in the 'Guardian' group."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and u.group and u.group.name == "Guardian")


class IsResident(BasePermission):
    """Only users in the 'Resident' group."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and u.group and u.group.name == "Resident")


class IsAdminOrSubAdminOrResident(BasePermission):
    """Admin, Sub Admin, or Resident -- used for Block/Flat read access per the spec doc."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and u.group and u.group.name in ["Admin", "Sub Admin", "Resident"])


class IsGatedSocietyAdmin(BasePermission):
    """Only users in the 'Admin' or 'Sub Admin' group can manage gated societies."""
    def has_permission(self, request, view):
        u = request.user
        return bool(
            u.is_authenticated and
            u.group and u.group.name in ["Admin", "Sub Admin"]
        )

class IsGuardianOrSubAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and u.group and u.group.name in ["Guardian", "Sub Admin"])