"""Django settings for stakeholder_analysis project."""
import os
import logging
import dj_database_url
from django.core.exceptions import ImproperlyConfigured

# ─────────────────────────────────────────────────────────────────────────────
# Required environment variable validation
# ─────────────────────────────────────────────────────────────────────────────


import sys
def _require_env(name: str, default=None, required=True) -> str:
    value = os.environ.get(name, default)
    if required and (value is None or str(value).strip() == ''):
        raise ImproperlyConfigured(
            f"Missing required environment variable: {name}. "
            f"Copy .env.example to .env and set this value."
        )
    return str(value).strip() if value is not None else value

# Only require DATABASE_URL if not running collectstatic (i.e., at runtime)
if 'collectstatic' in sys.argv:
    DATABASE_URL = os.environ.get('DATABASE_URL', 'postgres://dummy:dummy@localhost:5432/dummy')
    DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')
    ALLOWED_HOSTS = ['*']
else:
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

# OPENAI_API_KEY is optional until OpenAI provider is selected at runtime.
# Warn at startup if missing; provider-specific requests should validate this.
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '').strip()
if not OPENAI_API_KEY:
    logging.getLogger(__name__).warning(
        "OPENAI_API_KEY is not set. OpenAI-backed NER runs will fail if selected."
    )

# Allowed providers and model choices for NER extraction runs.
NER_PROVIDER_MODEL_ALLOWLIST = {
    'groq': ['llama-3.1-8b-instant'],
    'openai': ['gpt-4o-mini', 'gpt-5-mini', 'gpt-5-nano'],
}

NER_DEFAULT_PROVIDER = 'groq'
NER_DEFAULT_MODEL = 'llama-3.1-8b-instant'

# ─────────────────────────────────────────────────────────────────────────────
# Core settings
# ─────────────────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-insecure-secret-key-change-in-production')

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.staticfiles',  # <-- required for DRF static assets
    'corsheaders',
    'rest_framework',
    'ingestion',
    'ner',
    'reasoning',
    'graph',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
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

# ─────────────────────────────────────────────────────────────────────────────
# Templates (required for DRF and admin)
# ─────────────────────────────────────────────────────────────────────────────

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
            ],
        },
    },
]

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

# ─────────────────────────────────────────────────────────────────────────────
# CORS — allow frontend (localhost:3000) to call backend (localhost:8000)
# ─────────────────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CORS_ALLOW_HEADERS = ['accept', 'authorization', 'content-type', 'x-requested-with']
