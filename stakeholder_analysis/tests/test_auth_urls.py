from django.urls import resolve, reverse


def test_auth_url_names_resolve_correctly():
    assert reverse('auth-register') == '/api/auth/register/'
    assert reverse('auth-login') == '/api/auth/login/'
    assert reverse('auth-logout') == '/api/auth/logout/'
    assert reverse('auth-me') == '/api/auth/me/'
    assert reverse('auth-change-password') == '/api/auth/change-password/'
    assert reverse('auth-forgot-password') == '/api/auth/forgot-password/'
    assert reverse('auth-reset-password') == '/api/auth/reset-password/'
    assert reverse('auth-admin-users') == '/api/auth/admin/users/'
    assert reverse('auth-admin-user-detail', kwargs={'user_id': 1}) == '/api/auth/admin/users/1/'
    assert reverse('auth-admin-stats') == '/api/auth/admin/stats/'
    assert reverse('auth-admin-projects') == '/api/auth/admin/projects/'
    assert reverse('auth-admin-activity') == '/api/auth/admin/activity/'


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
