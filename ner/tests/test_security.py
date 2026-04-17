"""Security smoke tests for the NER/project API endpoints.

Covers:
- Authentication enforcement (unauthenticated → 401)
- Ownership isolation (authenticated user cannot access another user's project)
- Input sanitization / empty-query guard on /query/
- Admin endpoint access control
"""

import pytest
from unittest.mock import MagicMock, patch
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_user_and_client(username, email='u@example.com', is_staff=False):
    user = User.objects.create_user(username=username, email=email, password='TestPass1!')
    if is_staff:
        user.is_staff = True
        user.save()
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return user, client


def _make_project(owner, name='Sec Test Project'):
    from ingestion.models import Project
    return Project.objects.create(name=name, owner=owner)


# ─────────────────────────────────────────────────────────────────────────────
# Authentication enforcement
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAuthenticationRequired:
    """Every endpoint under /api/v1/projects/ requires a valid token."""

    def test_list_projects_unauthenticated_returns_401(self):
        resp = APIClient().get('/api/v1/projects/')
        assert resp.status_code == 401

    def test_create_project_unauthenticated_returns_401(self):
        resp = APIClient().post('/api/v1/projects/', {'name': 'New'}, format='json')
        assert resp.status_code == 401

    def test_project_detail_unauthenticated_returns_401(self):
        resp = APIClient().get('/api/v1/projects/00000000-0000-0000-0000-000000000001/')
        assert resp.status_code in (401, 404)  # 404 before 401 is acceptable

    def test_entity_list_unauthenticated_returns_401(self):
        resp = APIClient().get('/api/v1/projects/00000000-0000-0000-0000-000000000001/entities/')
        assert resp.status_code in (401, 404)

    def test_query_unauthenticated_returns_401(self):
        resp = APIClient().post(
            '/api/v1/projects/00000000-0000-0000-0000-000000000001/query/',
            {'query': 'hello'},
            format='json',
        )
        assert resp.status_code in (401, 404)


# ─────────────────────────────────────────────────────────────────────────────
# Ownership isolation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestOwnershipIsolation:
    """User A cannot access User B's projects."""

    def test_user_cannot_read_another_users_project(self):
        owner, _ = _make_user_and_client('sec_owner', 'owner@example.com')
        _, client_b = _make_user_and_client('sec_other', 'other@example.com')
        project = _make_project(owner)

        resp = client_b.get(f'/api/v1/projects/{project.id}/')
        assert resp.status_code == 404  # not 200 or 403 — invisible by design

    def test_user_cannot_post_query_on_another_users_project(self):
        owner, _ = _make_user_and_client('sec_qowner', 'qowner@example.com')
        _, client_b = _make_user_and_client('sec_qother', 'qother@example.com')
        project = _make_project(owner)

        resp = client_b.post(
            f'/api/v1/projects/{project.id}/query/',
            {'query': 'test query'},
            format='json',
        )
        assert resp.status_code == 404

    def test_user_cannot_delete_another_users_project(self):
        owner, _ = _make_user_and_client('sec_delowner', 'delowner@example.com')
        _, client_b = _make_user_and_client('sec_delother', 'delother@example.com')
        project = _make_project(owner)

        resp = client_b.delete(f'/api/v1/projects/{project.id}/')
        assert resp.status_code == 404

    def test_user_only_sees_own_projects_in_list(self):
        owner, client_owner = _make_user_and_client('sec_listowner', 'listowner@example.com')
        other, _ = _make_user_and_client('sec_listother', 'listother@example.com')
        _make_project(owner, 'Owner Project')
        _make_project(other, 'Other Project')

        resp = client_owner.get('/api/v1/projects/')
        assert resp.status_code == 200
        names = [p['name'] for p in (resp.data if isinstance(resp.data, list) else resp.data.get('results', []))]
        assert 'Owner Project' in names
        assert 'Other Project' not in names


# ─────────────────────────────────────────────────────────────────────────────
# Input validation on /query/
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSQLInjectionResistance:
    """SQL injection payloads must never cause 500 errors.

    Django ORM parameterizes all queries, so injection payloads are treated
    as literal search strings and return normal 200/400 responses.
    """

    PAYLOADS = [
        "'; DROP TABLE ner_entity; --",
        "1 OR 1=1",
        "1; SELECT * FROM auth_user; --",
        "' UNION SELECT username, password FROM auth_user --",
        "admin'--",
        "x' OR 'x'='x",
    ]

    def _project_client(self):
        user, client = _make_user_and_client('sec_sqlinj', 'sqlinj@example.com')
        project = _make_project(user)
        return project, client

    def test_sql_injection_in_query_does_not_cause_500(self):
        """Every SQL injection payload on /query/ must return <500."""
        project, client = self._project_client()

        for payload in self.PAYLOADS:
            with patch('ner.services.semantic_search.embed_query', return_value=[0.0] * 384), \
                 patch('ner.services.semantic_search.search_chunks', return_value=[]):
                resp = client.post(
                    f'/api/v1/projects/{project.id}/query/',
                    {'query': payload},
                    format='json',
                )
            assert resp.status_code < 500, (
                f"Payload {payload!r} caused status {resp.status_code}"
            )

    def test_sql_injection_in_entity_search_does_not_cause_500(self):
        """SQL injection in entity search/filter query params must not raise 500."""
        _, client = _make_user_and_client('sec_sqlinj2', 'sqlinj2@example.com')
        project = _make_project(_, 'Inj Project 2')

        for payload in self.PAYLOADS[:3]:
            resp = client.get(
                f'/api/v1/projects/{project.id}/entities/',
                {'search': payload},
            )
            assert resp.status_code < 500, (
                f"Entity search payload {payload!r} caused {resp.status_code}"
            )


@pytest.mark.django_db
class TestQueryInputValidation:
    """Empty or missing query string is rejected before any DB/model call."""

    def test_empty_query_returns_400(self):
        user, client = _make_user_and_client('sec_qval', 'qval@example.com')
        project = _make_project(user)

        resp = client.post(
            f'/api/v1/projects/{project.id}/query/',
            {'query': ''},
            format='json',
        )
        assert resp.status_code == 400

    def test_missing_query_key_returns_400(self):
        user, client = _make_user_and_client('sec_qmissing', 'qmiss@example.com')
        project = _make_project(user)

        resp = client.post(
            f'/api/v1/projects/{project.id}/query/',
            {},
            format='json',
        )
        assert resp.status_code == 400

    def test_whitespace_only_query_returns_400(self):
        user, client = _make_user_and_client('sec_qws', 'qws@example.com')
        project = _make_project(user)

        resp = client.post(
            f'/api/v1/projects/{project.id}/query/',
            {'query': '   '},
            format='json',
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Admin endpoint access control
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminEndpointAccessControl:
    """Non-admin authenticated users receive 403 on admin-only endpoints."""

    def test_regular_user_cannot_list_admin_users(self):
        _, client = _make_user_and_client('sec_regadm', 'regadm@example.com')
        resp = client.get('/api/auth/admin/users/')
        assert resp.status_code == 403

    def test_regular_user_cannot_view_admin_stats(self):
        _, client = _make_user_and_client('sec_regstat', 'regstat@example.com')
        resp = client.get('/api/auth/admin/stats/')
        assert resp.status_code == 403

    def test_regular_user_cannot_list_admin_projects(self):
        _, client = _make_user_and_client('sec_regproj', 'regproj@example.com')
        resp = client.get('/api/auth/admin/projects/')
        assert resp.status_code == 403

    def test_staff_user_can_access_admin_stats(self):
        _, client = _make_user_and_client('sec_staffstat', 'staffstat@example.com', is_staff=True)
        resp = client.get('/api/auth/admin/stats/')
        assert resp.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# Auth endpoint security
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAuthEndpointSecurity:
    """Core auth security properties."""

    def test_logout_without_token_returns_401(self):
        resp = APIClient().post('/api/auth/logout/')
        assert resp.status_code == 401

    def test_me_without_token_returns_401(self):
        resp = APIClient().get('/api/auth/me/')
        assert resp.status_code == 401

    def test_login_with_nonexistent_user_returns_400_not_500(self):
        resp = APIClient().post(
            '/api/auth/login/',
            {'username': 'nobody_at_all', 'password': 'SomePass1!'},
            format='json',
        )
        assert resp.status_code == 400
        assert 'code' in resp.data

    def test_login_with_wrong_password_returns_400(self):
        User.objects.create_user(username='sec_loginwrong', email='loginwrong@example.com', password='CorrectPass1!')
        resp = APIClient().post(
            '/api/auth/login/',
            {'username': 'sec_loginwrong', 'password': 'WrongPass!'},
            format='json',
        )
        assert resp.status_code == 400
        assert resp.data.get('code') == 'incorrect_password'

    def test_login_disabled_account_returns_403(self):
        User.objects.create_user(
            username='sec_disabled', email='disabled@example.com',
            password='Pass1!', is_active=False,
        )
        resp = APIClient().post(
            '/api/auth/login/',
            {'username': 'sec_disabled', 'password': 'Pass1!'},
            format='json',
        )
        assert resp.status_code == 403

    def test_register_duplicate_username_returns_400(self):
        User.objects.create_user(username='sec_dup', email='dup1@example.com', password='Pass1!')
        resp = APIClient().post(
            '/api/auth/register/',
            {'username': 'sec_dup', 'email': 'dup2@example.com', 'password': 'Pass1!'},
            format='json',
        )
        assert resp.status_code == 400

    def test_register_duplicate_email_returns_400(self):
        User.objects.create_user(username='sec_dupeml1', email='dupeml@example.com', password='Pass1!')
        resp = APIClient().post(
            '/api/auth/register/',
            {'username': 'sec_dupeml2', 'email': 'dupeml@example.com', 'password': 'Pass1!'},
            format='json',
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Document upload input sanitization
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDocumentUploadSecurity:
    """Document upload endpoint must reject unsupported types and enforce size limits."""

    def _upload_url(self):
        user, client = _make_user_and_client('sec_upload', 'upload@example.com')
        project = _make_project(user)
        return f'/api/v1/projects/{project.id}/documents/', client

    def test_unsupported_mime_type_returns_415(self):
        import io as _io
        url, client = self._upload_url()
        resp = client.post(
            url,
            {'file': _io.BytesIO(b'<html>page</html>')},
            format='multipart',
        )
        # Without filename extension the server must reject with 415 or 400
        assert resp.status_code in (400, 415)

    def test_unsupported_extension_returns_415(self):
        import io as _io
        from django.core.files.uploadedfile import SimpleUploadedFile
        url, client = self._upload_url()
        bad_file = SimpleUploadedFile('malware.exe', b'\x4d\x5a\x90', content_type='application/octet-stream')
        resp = client.post(url, {'file': bad_file}, format='multipart')
        assert resp.status_code == 415

    def test_no_file_field_returns_400(self):
        url, client = self._upload_url()
        resp = client.post(url, {}, format='multipart')
        assert resp.status_code == 400

    def test_unauthenticated_upload_returns_401(self):
        import io as _io
        from django.core.files.uploadedfile import SimpleUploadedFile
        user, _ = _make_user_and_client('sec_upload_noauth', 'uploadnoauth@example.com')
        project = _make_project(user)
        url = f'/api/v1/projects/{project.id}/documents/'
        good_file = SimpleUploadedFile('test.pdf', b'%PDF-1.4', content_type='application/pdf')
        resp = APIClient().post(url, {'file': good_file}, format='multipart')
        assert resp.status_code == 401

    def test_filename_with_path_traversal_is_sanitized_or_stored_safely(self):
        """../../etc/passwd style filenames must not cause 500 or file system traversal.

        The view stores the filename as a DB string; no file-system write occurs.
        We verify that the server does not crash (< 500).
        """
        from django.core.files.uploadedfile import SimpleUploadedFile
        from ingestion.models import Document
        from unittest.mock import patch as _patch, MagicMock as _MM

        url, client = self._upload_url()
        evil_file = SimpleUploadedFile('../../etc/passwd.pdf', b'%PDF-1.4 fake', content_type='application/pdf')

        fake_doc = _MM(spec=Document)
        fake_doc.id = 'doc-path-traversal'
        fake_doc.filename = '../../etc/passwd.pdf'
        fake_doc.file_format = 'pdf'
        fake_doc.processing_status = 'completed'
        fake_doc.chunk_count = 1
        fake_doc.upload_timestamp = None
        fake_doc.raw_text = ''
        fake_doc.cleaned_text = ''

        with _patch('ingestion.views.ingest_document', return_value=fake_doc):
            resp = client.post(url, {'file': evil_file}, format='multipart')
        assert resp.status_code < 500
