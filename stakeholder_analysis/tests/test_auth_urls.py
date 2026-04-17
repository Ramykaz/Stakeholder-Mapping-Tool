from django.urls import resolve, reverse


def test_auth_url_names_resolve_correctly():
    assert reverse('auth-register') == '/api/v1/auth/register/'
    assert reverse('auth-login') == '/api/v1/auth/login/'
    assert reverse('auth-logout') == '/api/v1/auth/logout/'
    assert reverse('auth-me') == '/api/v1/auth/me/'
    assert reverse('auth-change-password') == '/api/v1/auth/change-password/'
    assert reverse('auth-forgot-password') == '/api/v1/auth/forgot-password/'
    assert reverse('auth-reset-password') == '/api/v1/auth/reset-password/'
    assert reverse('auth-admin-users') == '/api/v1/auth/admin/users/'
    assert reverse('auth-admin-user-detail', kwargs={'user_id': 1}) == '/api/v1/auth/admin/users/1/'
    assert reverse('auth-admin-stats') == '/api/v1/auth/admin/stats/'
    assert reverse('auth-admin-projects') == '/api/v1/auth/admin/projects/'
    assert reverse('auth-admin-activity') == '/api/v1/auth/admin/activity/'


def test_auth_url_patterns_are_resolvable():
    assert resolve('/api/auth/register/').url_name == 'auth-register'
    assert resolve('/api/auth/login/').url_name == 'auth-login'
    assert resolve('/api/auth/logout/').url_name == 'auth-logout'
    assert resolve('/api/auth/me/').url_name == 'auth-me'
    assert resolve('/api/auth/change-password/').url_name == 'auth-change-password'
    assert resolve('/api/auth/forgot-password/').url_name == 'auth-forgot-password'
    assert resolve('/api/auth/reset-password/').url_name == 'auth-reset-password'
    assert resolve('/api/auth/admin/users/').url_name == 'auth-admin-users'
    assert resolve('/api/auth/admin/users/123/').url_name == 'auth-admin-user-detail'
    assert resolve('/api/auth/admin/stats/').url_name == 'auth-admin-stats'
    assert resolve('/api/auth/admin/projects/').url_name == 'auth-admin-projects'
    assert resolve('/api/auth/admin/activity/').url_name == 'auth-admin-activity'

    assert resolve('/api/v1/auth/register/').url_name == 'auth-register'
    assert resolve('/api/v1/auth/login/').url_name == 'auth-login'
    assert resolve('/api/v1/auth/logout/').url_name == 'auth-logout'
    assert resolve('/api/v1/auth/me/').url_name == 'auth-me'
    assert resolve('/api/v1/auth/change-password/').url_name == 'auth-change-password'
    assert resolve('/api/v1/auth/forgot-password/').url_name == 'auth-forgot-password'
    assert resolve('/api/v1/auth/reset-password/').url_name == 'auth-reset-password'
    assert resolve('/api/v1/auth/admin/users/').url_name == 'auth-admin-users'
    assert resolve('/api/v1/auth/admin/users/123/').url_name == 'auth-admin-user-detail'
    assert resolve('/api/v1/auth/admin/stats/').url_name == 'auth-admin-stats'
    assert resolve('/api/v1/auth/admin/projects/').url_name == 'auth-admin-projects'
    assert resolve('/api/v1/auth/admin/activity/').url_name == 'auth-admin-activity'
