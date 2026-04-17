from django.test import override_settings

from stakeholder_analysis.auth_views import _is_admin_email


@override_settings(ADMIN_EMAIL_DOMAIN='undp.org', ADMIN_AUTO_ADMIN_EMAILS=['admin@undp.org'])
def test_is_admin_email_true_for_allowlisted_undp_email():
    assert _is_admin_email('admin@undp.org') is True


@override_settings(ADMIN_EMAIL_DOMAIN='undp.org', ADMIN_AUTO_ADMIN_EMAILS=['admin@undp.org'])
def test_is_admin_email_false_for_non_allowlisted_undp_email():
    assert _is_admin_email('user@undp.org') is False


@override_settings(ADMIN_EMAIL_DOMAIN='undp.org', ADMIN_AUTO_ADMIN_EMAILS=['admin@undp.org'])
def test_is_admin_email_false_for_non_undp_domain():
    assert _is_admin_email('admin@example.com') is False


@override_settings(ADMIN_EMAIL_DOMAIN='undp.org', ADMIN_AUTO_ADMIN_EMAILS='admin@undp.org,owner@undp.org')
def test_is_admin_email_supports_csv_allowlist_setting():
    assert _is_admin_email('owner@undp.org') is True
