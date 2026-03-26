"""Authentication API views for registration, login, logout, profile, and admin."""

from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import logging


User = get_user_model()
logger = logging.getLogger(__name__)


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


def _user_payload(user):
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'is_admin': bool(user.is_staff or user.is_superuser),
        'is_active': user.is_active,
        'date_joined': user.date_joined.isoformat() if user.date_joined else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Serializers
# ─────────────────────────────────────────────────────────────────────────────

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value

    def validate_email(self, value):
        normalized = (value or '').strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError('Email is already registered.')
        return normalized

    def validate_password(self, value):
        validate_password(value)
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

    def validate_username(self, value):
        username = (value or '').strip()
        if not username:
            raise serializers.ValidationError('Username is required.')
        return username

    def validate_password(self, value):
        if not value:
            raise serializers.ValidationError('Password is required.')
        return value


# ─────────────────────────────────────────────────────────────────────────────
# Core Auth Views
# ─────────────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        logger.info('[AUTH] register success user_id=%s username=%s is_admin=%s', user.id, user.username, bool(user.is_staff))
        return Response(
            {'token': token.key, 'user': _user_payload(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        user_obj = User.objects.filter(username__iexact=username).first()
        if not user_obj:
            user_obj = User.objects.filter(email__iexact=username).first()
        if not user_obj:
            logger.info('[AUTH] login failed reason=invalid_credentials username=%s', username)
            return Response(
                {'code': 'invalid_credentials', 'detail': 'No account found. Check your email and try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user_obj.check_password(password):
            logger.info('[AUTH] login failed reason=incorrect_password username=%s user_id=%s', username, user_obj.id)
            return Response(
                {'code': 'incorrect_password', 'detail': 'Incorrect password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user_obj.is_active:
            return Response(
                {'code': 'account_disabled', 'detail': 'Your account has been disabled. Contact an administrator.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = authenticate(request=request, username=user_obj.username, password=password)
        if not user:
            return Response(
                {'code': 'invalid_credentials', 'detail': 'Invalid credentials.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token, _ = Token.objects.get_or_create(user=user)
        logger.info('[AUTH] login success user_id=%s username=%s', user.id, user.username)
        return Response({'token': token.key, 'user': _user_payload(user)}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logger.info('[AUTH] logout user_id=%s username=%s', request.user.id, request.user.username)
        Token.objects.filter(user=request.user).delete()
        return Response({'status': 'logged_out'}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'user': _user_payload(request.user)}, status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        new_username = (request.data.get('username') or '').strip()
        new_email = (request.data.get('email') or '').strip().lower()

        if new_username and new_username != user.username:
            if User.objects.filter(username__iexact=new_username).exclude(pk=user.pk).exists():
                return Response({'detail': 'Username already taken.'}, status=status.HTTP_400_BAD_REQUEST)
            user.username = new_username

        if new_email and new_email != user.email:
            if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
                return Response({'detail': 'Email already registered.'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = new_email

        user.save()
        logger.info('[AUTH] profile updated user_id=%s', user.id)
        return Response({'user': _user_payload(user)}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.data.get('current_password', '')
        new_pw = request.data.get('new_password', '')

        if not request.user.check_password(current):
            return Response({'detail': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_pw, user=request.user)
        except Exception as e:
            return Response({'detail': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_pw)
        request.user.save()
        # Re-issue token so the user stays logged in
        Token.objects.filter(user=request.user).delete()
        token, _ = Token.objects.get_or_create(user=request.user)
        logger.info('[AUTH] password changed user_id=%s', request.user.id)
        return Response({'token': token.key, 'user': _user_payload(request.user)}, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        # Always 200 to avoid user enumeration
        if not user:
            return Response(
                {'detail': 'If that email is registered, a reset link has been sent.'},
                status=status.HTTP_200_OK,
            )

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_path = f"/reset-password?uid={uid}&token={token}"

        # TODO: send via email backend when configured (SendGrid/SES)
        logger.info('[AUTH] password reset requested user_id=%s reset_path=%s', user.id, reset_path)

        response_data = {'detail': 'If that email is registered, a reset link has been sent.'}
        if getattr(settings, 'DEBUG', False):
            response_data['_debug_reset_path'] = reset_path

        return Response(response_data, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        new_password = request.data.get('new_password', '')

        if not uid or not token or not new_password:
            return Response(
                {'detail': 'uid, token, and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({'detail': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response(
                {'detail': 'Reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=user)
        except Exception as e:
            return Response({'detail': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        Token.objects.filter(user=user).delete()
        logger.info('[AUTH] password reset complete user_id=%s', user.id)
        return Response({'detail': 'Password has been reset. Please sign in.'}, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Admin-only Views
# ─────────────────────────────────────────────────────────────────────────────

class AdminRequiredMixin:
    def _check_admin(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        return None


class AdminUserListView(AdminRequiredMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = self._check_admin(request)
        if err:
            return err

        search = (request.query_params.get('search') or '').strip()
        qs = User.objects.all().order_by('date_joined')
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(username__icontains=search) | Q(email__icontains=search))

        page_size = 50
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (ValueError, TypeError):
            page = 1
        offset = (page - 1) * page_size
        total = qs.count()
        users = list(qs[offset:offset + page_size])

        return Response({
            'count': total,
            'page': page,
            'results': [_user_payload(u) for u in users],
        }, status=status.HTTP_200_OK)


class AdminUserDetailView(AdminRequiredMixin, APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        err = self._check_admin(request)
        if err:
            return err

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user and 'is_admin' in request.data and not request.data['is_admin']:
            return Response({'detail': 'You cannot remove your own admin status.'}, status=status.HTTP_400_BAD_REQUEST)

        if 'is_admin' in request.data:
            user.is_staff = bool(request.data['is_admin'])
        if 'is_active' in request.data:
            user.is_active = bool(request.data['is_active'])

        user.save()
        logger.info('[AUTH] admin updated user user_id=%s by admin_id=%s', user.id, request.user.id)
        return Response({'user': _user_payload(user)}, status=status.HTTP_200_OK)

    def delete(self, request, user_id):
        err = self._check_admin(request)
        if err:
            return err

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response({'detail': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        logger.info('[AUTH] admin deleted user user_id=%s by admin_id=%s', user.id, request.user.id)
        user.delete()
        return Response({'detail': 'User deleted.'}, status=status.HTTP_200_OK)


class AdminStatsView(AdminRequiredMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = self._check_admin(request)
        if err:
            return err

        from ingestion.models import Project, Document
        from ner.models import Entity, Relation

        return Response({
            'users': User.objects.count(),
            'active_users': User.objects.filter(is_active=True).count(),
            'admin_users': User.objects.filter(is_staff=True).count(),
            'projects': Project.objects.count(),
            'documents': Document.objects.count(),
            'entities': Entity.objects.count(),
            'flagged_entities': Entity.objects.filter(is_flagged=True).count(),
            'relations': Relation.objects.count(),
        }, status=status.HTTP_200_OK)


class AdminProjectListView(AdminRequiredMixin, APIView):
    """GET /api/v1/auth/admin/projects/ — all projects across all users."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = self._check_admin(request)
        if err:
            return err

        from ingestion.models import Project, Document
        from django.db.models import Count

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        search = request.query_params.get('search', '').strip()

        qs = (
            Project.objects
            .select_related('owner')
            .annotate(document_count=Count('documents', distinct=True))
            .annotate(entity_count=Count('documents__entities', distinct=True))
            .order_by('-updated_at')
        )
        if search:
            qs = qs.filter(name__icontains=search)

        total = qs.count()
        start = (page - 1) * page_size
        projects = list(qs[start:start + page_size])

        results = []
        for p in projects:
            results.append({
                'id': str(p.id),
                'name': p.name,
                'description': p.description or '',
                'owner_username': p.owner.username if p.owner else '—',
                'owner_email': p.owner.email if p.owner else '',
                'document_count': p.document_count,
                'entity_count': p.entity_count,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'updated_at': p.updated_at.isoformat() if p.updated_at else None,
            })

        return Response({'count': total, 'results': results}, status=status.HTTP_200_OK)


class AdminActivityView(AdminRequiredMixin, APIView):
    """GET /api/v1/auth/admin/activity/ — recent extraction runs across all projects."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = self._check_admin(request)
        if err:
            return err

        from ner.models import NERRun

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))

        qs = (
            NERRun.objects
            .select_related('document_id', 'document_id__project', 'document_id__project__owner')
            .order_by('-created_at')
        )
        total = qs.count()
        start = (page - 1) * page_size
        runs = list(qs[start:start + page_size])

        results = []
        for r in runs:
            doc = r.document_id
            project = doc.project if doc else None
            owner = project.owner if project else None
            results.append({
                'id': str(r.id),
                'document_name': doc.filename if doc else '—',
                'project_name': project.name if project else '—',
                'owner_username': owner.username if owner else '—',
                'provider': r.provider or '—',
                'model': r.model or '—',
                'status': r.status,
                'entities_created': getattr(r, 'entities_created', None),
                'cost_usd': str(r.cost_usd) if r.cost_usd else None,
                'created_at': r.created_at.isoformat() if r.created_at else None,
            })

        return Response({'count': total, 'results': results}, status=status.HTTP_200_OK)
