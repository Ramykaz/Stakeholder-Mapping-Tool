"""Tests for required environment variable validation in settings.py."""
import subprocess
import sys
import os
import pytest


def _run_django_check(env_overrides: dict) -> subprocess.CompletedProcess:
    """Run `python manage.py check` in a subprocess with modified environment."""
    env = os.environ.copy()
    # Start from a clean slate for required vars.
    for key in ('DATABASE_URL', 'DEBUG', 'ALLOWED_HOSTS', 'GROQ_API_KEY', 'SECRET_KEY'):
        env.pop(key, None)
    # Apply the provided values.
    env.update(env_overrides)

    return subprocess.run(
        [sys.executable, 'manage.py', 'check', '--deploy'],
        capture_output=True,
        text=True,
        env=env,
        cwd=os.path.join(os.path.dirname(__file__), '..', '..'),
    )


class TestRequiredEnvVars:
    def test_missing_database_url_fails_with_named_error(self):
        result = _run_django_check({
            'DEBUG': 'True',
            'ALLOWED_HOSTS': 'localhost',
        })
        assert result.returncode != 0
        # The error message must name the missing variable.
        combined = result.stdout + result.stderr
        assert 'DATABASE_URL' in combined

    def test_missing_debug_fails_with_named_error(self):
        result = _run_django_check({
            'DATABASE_URL': 'postgresql://user:pass@localhost/db',
            'ALLOWED_HOSTS': 'localhost',
        })
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert 'DEBUG' in combined

    def test_missing_allowed_hosts_fails_with_named_error(self):
        result = _run_django_check({
            'DATABASE_URL': 'postgresql://user:pass@localhost/db',
            'DEBUG': 'True',
        })
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert 'ALLOWED_HOSTS' in combined

    def test_all_required_vars_set_does_not_raise(self):
        """Settings import should succeed when all required vars are present."""

        # This is tested implicitly by the test suite running at all —
        # conftest.py sets all required env vars before Django initialises.
        # We assert that the settings module can be imported without exception.
        try:
            import stakeholder_analysis.settings  # noqa
        except Exception as exc:
            pytest.fail(f"settings.py raised an unexpected exception: {exc}")
