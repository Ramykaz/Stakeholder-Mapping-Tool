from django.test import override_settings
from django.urls import resolve, reverse

from stakeholder_analysis.auth_views import _is_admin_email


def test_auth_url_names_and_resolve_roundtrip():
    names = [
        ('auth-register', '/api/v1/auth/register/'),
        ('auth-login', '/api/v1/auth/login/'),
        ('auth-logout', '/api/v1/auth/logout/'),
        ('auth-me', '/api/v1/auth/me/'),
        ('auth-change-password', '/api/v1/auth/change-password/'),
        ('auth-forgot-password', '/api/v1/auth/forgot-password/'),
        ('auth-reset-password', '/api/v1/auth/reset-password/'),
        ('auth-admin-users', '/api/v1/auth/admin/users/'),
        ('auth-admin-stats', '/api/v1/auth/admin/stats/'),
        ('auth-admin-projects', '/api/v1/auth/admin/projects/'),
        ('auth-admin-activity', '/api/v1/auth/admin/activity/'),
    ]

    for name, path in names:
        assert reverse(name) == path
        assert resolve(path).url_name == name

    assert reverse('auth-admin-user-detail', kwargs={'user_id': 7}) == '/api/v1/auth/admin/users/7/'
    assert resolve('/api/v1/auth/admin/users/7/').url_name == 'auth-admin-user-detail'


@override_settings(ADMIN_EMAIL_DOMAIN='undp.org', ADMIN_AUTO_ADMIN_EMAILS=['admin@undp.org'])
def test_is_admin_email_allowlist_behavior():
    assert _is_admin_email('admin@undp.org') is True
    assert _is_admin_email('user@undp.org') is False
    assert _is_admin_email('admin@example.com') is False


@override_settings(ADMIN_EMAIL_DOMAIN='undp.org', ADMIN_AUTO_ADMIN_EMAILS='admin@undp.org,owner@undp.org')
def test_is_admin_email_supports_csv_allowlist():
    assert _is_admin_email('owner@undp.org') is True
