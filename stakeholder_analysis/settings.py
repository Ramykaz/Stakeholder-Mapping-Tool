"""Django settings for stakeholder_analysis project."""
import os
import logging
import dj_database_url
from django.core.exceptions import ImproperlyConfigured

# ─────────────────────────────────────────────────────────────────────────────
# Required environment variable validation
# ─────────────────────────────────────────────────────────────────────────────

def _require_env(name: str) -> str:
    value = os.environ.get(name, '').strip()
    if not value:
        raise ImproperlyConfigured(
            f"Missing required environment variable: {name}. "
            f"Copy .env.example to .env and set this value."
        )
    return value


DATABASE_URL = _require_env('DATABASE_URL')
DEBUG = _require_env('DEBUG').lower() in ('true', '1', 'yes')
ALLOWED_HOSTS = [h.strip() for h in _require_env('ALLOWED_HOSTS').split(',') if h.strip()]

# GROQ_API_KEY is required by NER/reasoning apps but not by ingestion.
# Warn at startup if missing; do not block.
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '').strip()
if not GROQ_API_KEY:
    logging.getLogger(__name__).warning(
        "GROQ_API_KEY is not set. NER and reasoning features will not function."
    )

# ─────────────────────────────────────────────────────────────────────────────
# Core settings
# ─────────────────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-insecure-secret-key-change-in-production')

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'rest_framework',
    'ingestion',
    'ner',
    'reasoning',
    'graph',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'stakeholder_analysis.urls'
WSGI_APPLICATION = 'stakeholder_analysis.wsgi.application'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─────────────────────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────────────────────

DATABASES = {
    'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600)
}

# ─────────────────────────────────────────────────────────────────────────────
# File uploads
# ─────────────────────────────────────────────────────────────────────────────

# Maximum upload size: 50 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 52_428_800  # 50 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 52_428_800

# ─────────────────────────────────────────────────────────────────────────────
# Internationalisation
# ─────────────────────────────────────────────────────────────────────────────

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_TZ = True

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}
