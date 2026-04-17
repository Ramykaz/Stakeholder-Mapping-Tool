"""Unit and integration tests for stakeholder_analysis/auth_views.py.

Covers _user_payload helper, ForgotPasswordView, ResetPasswordView,
ChangePasswordView, AdminUserListView, AdminUserDetailView, and AdminStatsView.
"""

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _authed_client(user):
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return client


# ─────────────────────────────────────────────────────────────────────────────
# _user_payload
# ─────────────────────────────────────────────────────────────────────────────

class TestUserPayload:
    def test_returns_required_keys(self, db):
        from stakeholder_analysis.auth_views import _user_payload
        user = User.objects.create_user(username='payload_u', email='p@example.com', password='pass')
        payload = _user_payload(user)
        for key in ('id', 'username', 'email', 'is_admin', 'is_active', 'date_joined'):
            assert key in payload

    def test_is_admin_false_for_regular_user(self, db):
        from stakeholder_analysis.auth_views import _user_payload
        user = User.objects.create_user(username='payload_reg', email='reg@example.com', password='pass')
        assert _user_payload(user)['is_admin'] is False

    def test_is_admin_true_for_staff(self, db):
        from stakeholder_analysis.auth_views import _user_payload
        user = User.objects.create_user(username='payload_staff', email='staff@example.com', password='pass', is_staff=True)
        assert _user_payload(user)['is_admin'] is True

    def test_is_admin_true_for_superuser(self, db):
        from stakeholder_analysis.auth_views import _user_payload
        user = User.objects.create_superuser(username='payload_su', email='su@example.com', password='pass')
        assert _user_payload(user)['is_admin'] is True

    def test_date_joined_is_iso_string(self, db):
        from stakeholder_analysis.auth_views import _user_payload
        user = User.objects.create_user(username='payload_dj', email='dj@example.com', password='pass')
        dj = _user_payload(user)['date_joined']
        assert isinstance(dj, str)
        assert 'T' in dj  # ISO 8601


# ─────────────────────────────────────────────────────────────────────────────
# ChangePasswordView
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestChangePasswordView:
    URL = '/api/auth/change-password/'

    def _user_and_client(self):
        user = User.objects.create_user(username='chpw_u', email='chpw@example.com', password='OldPass1!')
        return user, _authed_client(user)

    def test_correct_current_password_returns_200_with_new_token(self):
        user, client = self._user_and_client()
        resp = client.post(self.URL, {'current_password': 'OldPass1!', 'new_password': 'NewPass2@'})
        assert resp.status_code == 200
        assert 'token' in resp.data

    def test_wrong_current_password_returns_400(self):
        _, client = self._user_and_client()
        resp = client.post(self.URL, {'current_password': 'WrongPass!', 'new_password': 'NewPass2@'})
        assert resp.status_code == 400

    def test_weak_new_password_returns_400(self):
        _, client = self._user_and_client()
        resp = client.post(self.URL, {'current_password': 'OldPass1!', 'new_password': '123'})
        assert resp.status_code == 400

    def test_unauthenticated_returns_401(self):
        resp = APIClient().post(self.URL, {'current_password': 'x', 'new_password': 'y'})
        assert resp.status_code == 401

    def test_new_token_is_reissued(self):
        user, client = self._user_and_client()
        old_token = Token.objects.get(user=user).key
        client.post(self.URL, {'current_password': 'OldPass1!', 'new_password': 'NewPass2@'})
        new_token = Token.objects.get(user=user).key
        assert new_token != old_token


# ─────────────────────────────────────────────────────────────────────────────
# ForgotPasswordView
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestForgotPasswordView:
    URL = '/api/auth/forgot-password/'

    def test_known_email_returns_200(self):
        User.objects.create_user(username='fp_known', email='known@example.com', password='pass')
        resp = APIClient().post(self.URL, {'email': 'known@example.com'})
        assert resp.status_code == 200

    def test_unknown_email_also_returns_200_no_enumeration(self):
        resp = APIClient().post(self.URL, {'email': 'ghost@example.com'})
        assert resp.status_code == 200
        assert 'reset link' in resp.data.get('detail', '').lower()

    def test_empty_email_returns_400(self):
        resp = APIClient().post(self.URL, {'email': ''})
        assert resp.status_code == 400

    @override_settings(DEBUG=True)
    def test_debug_mode_exposes_reset_path(self):
        User.objects.create_user(username='fp_debug', email='debug@example.com', password='pass')
        resp = APIClient().post(self.URL, {'email': 'debug@example.com'})
        assert '_debug_reset_path' in resp.data

    def test_inactive_user_does_not_expose_reset_path(self):
        User.objects.create_user(username='fp_inactive', email='inactive@example.com', password='pass', is_active=False)
        resp = APIClient().post(self.URL, {'email': 'inactive@example.com'})
        assert '_debug_reset_path' not in resp.data


# ─────────────────────────────────────────────────────────────────────────────
# ResetPasswordView
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestResetPasswordView:
    URL = '/api/auth/reset-password/'

    def _get_reset_tokens(self, email='reset@example.com', password='OldPass1!', username='reset_u'):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        user = User.objects.create_user(username=username, email=email, password=password)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        return uid, token, user

    def test_valid_uid_and_token_resets_password(self):
        uid, token, user = self._get_reset_tokens()
        resp = APIClient().post(self.URL, {'uid': uid, 'token': token, 'new_password': 'BrandNew9#'})
        assert resp.status_code == 200
        user.refresh_from_db()
        assert user.check_password('BrandNew9#')

    def test_invalid_token_returns_400(self):
        uid, _, _ = self._get_reset_tokens(username='reset_u2', email='reset2@example.com')
        resp = APIClient().post(self.URL, {'uid': uid, 'token': 'badtoken', 'new_password': 'BrandNew9#'})
        assert resp.status_code == 400

    def test_missing_fields_returns_400(self):
        resp = APIClient().post(self.URL, {'uid': '', 'token': '', 'new_password': ''})
        assert resp.status_code == 400

    def test_invalid_uid_returns_400(self):
        resp = APIClient().post(self.URL, {'uid': 'notbase64!!', 'token': 'tok', 'new_password': 'BrandNew9#'})
        assert resp.status_code == 400

    def test_weak_new_password_returns_400(self):
        uid, token, _ = self._get_reset_tokens(username='reset_u3', email='reset3@example.com')
        resp = APIClient().post(self.URL, {'uid': uid, 'token': token, 'new_password': '123'})
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# AdminUserListView
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminUserListView:
    URL = '/api/auth/admin/users/'

    def _admin_client(self):
        admin = User.objects.create_user(username='aulv_admin', email='aulv@example.com', password='pass', is_staff=True)
        return _authed_client(admin)

    def _regular_client(self):
        user = User.objects.create_user(username='aulv_reg', email='aulvreg@example.com', password='pass')
        return _authed_client(user)

    def test_admin_gets_user_list(self):
        client = self._admin_client()
        resp = client.get(self.URL)
        assert resp.status_code == 200
        assert 'results' in resp.data
        assert 'count' in resp.data

    def test_regular_user_gets_403(self):
        client = self._regular_client()
        resp = client.get(self.URL)
        assert resp.status_code == 403

    def test_unauthenticated_gets_401(self):
        resp = APIClient().get(self.URL)
        assert resp.status_code == 401

    def test_search_filters_by_username(self):
        User.objects.create_user(username='searchable_xyz', email='xyz@example.com', password='pass')
        client = self._admin_client()
        resp = client.get(self.URL, {'search': 'searchable_xyz'})
        assert resp.status_code == 200
        usernames = [u['username'] for u in resp.data['results']]
        assert 'searchable_xyz' in usernames

    def test_pagination_page_param(self):
        client = self._admin_client()
        resp = client.get(self.URL, {'page': 1})
        assert resp.status_code == 200
        assert resp.data['page'] == 1


# ─────────────────────────────────────────────────────────────────────────────
# AdminUserDetailView
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminUserDetailView:
    def _url(self, user_id):
        return f'/api/auth/admin/users/{user_id}/'

    def _admin_and_target(self):
        admin = User.objects.create_user(username='audv_admin', email='audvadm@example.com', password='pass', is_staff=True)
        target = User.objects.create_user(username='audv_target', email='audvtgt@example.com', password='pass')
        return admin, target, _authed_client(admin)

    def test_admin_can_deactivate_user(self):
        admin, target, client = self._admin_and_target()
        resp = client.patch(self._url(target.id), {'is_active': False}, format='json')
        assert resp.status_code == 200
        target.refresh_from_db()
        assert target.is_active is False

    def test_admin_can_promote_to_staff(self):
        admin, target, client = self._admin_and_target()
        resp = client.patch(self._url(target.id), {'is_admin': True}, format='json')
        assert resp.status_code == 200
        target.refresh_from_db()
        assert target.is_staff is True

    def test_admin_cannot_remove_own_admin_status(self):
        admin, _, client = self._admin_and_target()
        resp = client.patch(self._url(admin.id), {'is_admin': False}, format='json')
        assert resp.status_code == 400

    def test_admin_cannot_delete_own_account(self):
        admin, _, client = self._admin_and_target()
        resp = client.delete(self._url(admin.id))
        assert resp.status_code == 400

    def test_admin_can_delete_other_user(self):
        _, target, client = self._admin_and_target()
        resp = client.delete(self._url(target.id))
        assert resp.status_code == 200
        assert not User.objects.filter(pk=target.id).exists()

    def test_patch_nonexistent_user_returns_404(self):
        admin = User.objects.create_user(username='audv_404', email='audv404@example.com', password='pass', is_staff=True)
        client = _authed_client(admin)
        resp = client.patch(self._url(99999), {'is_active': False}, format='json')
        assert resp.status_code == 404

    def test_regular_user_gets_403(self):
        target = User.objects.create_user(username='audv_regpatch', email='regpatch@example.com', password='pass')
        regular = User.objects.create_user(username='audv_regular', email='audvreg@example.com', password='pass')
        client = _authed_client(regular)
        resp = client.patch(self._url(target.id), {'is_active': False}, format='json')
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# AdminStatsView
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminStatsView:
    URL = '/api/auth/admin/stats/'

    def test_admin_gets_stats_dict(self):
        admin = User.objects.create_user(username='stats_admin', email='statsadm@example.com', password='pass', is_staff=True)
        client = _authed_client(admin)
        resp = client.get(self.URL)
        assert resp.status_code == 200
        for key in ('users', 'active_users', 'admin_users', 'projects', 'documents', 'entities', 'relations'):
            assert key in resp.data

    def test_regular_user_gets_403(self):
        user = User.objects.create_user(username='stats_reg', email='statsreg@example.com', password='pass')
        client = _authed_client(user)
        resp = client.get(self.URL)
        assert resp.status_code == 403

    def test_unauthenticated_gets_401(self):
        resp = APIClient().get(self.URL)
        assert resp.status_code == 401

    def test_stats_counts_are_integers(self):
        admin = User.objects.create_user(username='stats_int', email='statsint@example.com', password='pass', is_staff=True)
        client = _authed_client(admin)
        resp = client.get(self.URL)
        for key in ('users', 'active_users', 'admin_users', 'projects', 'documents'):
            assert isinstance(resp.data[key], int)
