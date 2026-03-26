"""Authentication endpoint routes."""

from django.urls import path
from .auth_views import (
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    ChangePasswordView,
    ForgotPasswordView,
    ResetPasswordView,
    AdminUserListView,
    AdminUserDetailView,
    AdminStatsView,
)


urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='auth-reset-password'),
    path('admin/users/', AdminUserListView.as_view(), name='auth-admin-users'),
    path('admin/users/<int:user_id>/', AdminUserDetailView.as_view(), name='auth-admin-user-detail'),
    path('admin/stats/', AdminStatsView.as_view(), name='auth-admin-stats'),
]
