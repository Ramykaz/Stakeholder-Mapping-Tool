"""Authentication API views for registration, login, logout, and profile."""

from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


User = get_user_model()


def _is_admin_email(email: str) -> bool:
    domain = getattr(settings, 'ADMIN_EMAIL_DOMAIN', 'undp.org')
    auto_admin_emails = getattr(settings, 'ADMIN_AUTO_ADMIN_EMAILS', [])
    normalized_domain = str(domain or '').strip().lower().lstrip('@')
    normalized_email = (email or '').strip().lower()
    if not normalized_domain or not normalized_email:
        return False

    if isinstance(auto_admin_emails, str):
        allowlist = {
            item.strip().lower()
            for item in auto_admin_emails.split(',')
            if item.strip()
        }
    else:
        allowlist = {
            str(item).strip().lower()
            for item in auto_admin_emails
            if str(item).strip()
        }

    is_undp_domain = normalized_email.endswith(f"@{normalized_domain}")
    return is_undp_domain and normalized_email in allowlist


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value

    def create(self, validated_data):
        email = (validated_data.get('email') or '').strip()
        is_staff = _is_admin_email(email)
        return User.objects.create_user(
            username=validated_data['username'],
            email=email,
            password=validated_data['password'],
            is_staff=is_staff,
        )


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)


def _user_payload(user):
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'is_admin': bool(user.is_staff or user.is_superuser),
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                'token': token.key,
                'user': _user_payload(user),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request=request,
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
        )
        if not user:
            return Response(
                {'detail': 'Invalid username or password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                'token': token.key,
                'user': _user_payload(user),
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({'status': 'logged_out'}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'user': _user_payload(request.user)}, status=status.HTTP_200_OK)
