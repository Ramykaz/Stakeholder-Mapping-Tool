"""Django settings for stakeholder_analysis project."""
import os
import logging
import dj_database_url
import sentry_sdk
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


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return str(value).strip().lower() in ('true', '1', 'yes', 'on')

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

# Azure OpenAI is optional until selected at runtime. Endpoint/deployment are
# expected for configuration readiness, while API key may be provisioned later.
AZURE_OPENAI_ENDPOINT = os.environ.get('AZURE_OPENAI_ENDPOINT', '').strip()
AZURE_OPENAI_DEPLOYMENT = os.environ.get('AZURE_OPENAI_DEPLOYMENT', '').strip()
AZURE_OPENAI_API_KEY = os.environ.get('AZURE_OPENAI_API_KEY', '').strip()
AZURE_OPENAI_API_VERSION = os.environ.get('AZURE_OPENAI_API_VERSION', '2024-12-01-preview').strip()
if AZURE_OPENAI_ENDPOINT and not AZURE_OPENAI_DEPLOYMENT:
    logging.getLogger(__name__).warning(
        "AZURE_OPENAI_ENDPOINT is set but AZURE_OPENAI_DEPLOYMENT is missing. "
        "Azure-backed NER runs will fail if selected."
    )
if AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT and not AZURE_OPENAI_API_KEY:
    logging.getLogger(__name__).warning(
        "Azure OpenAI endpoint/deployment configured without AZURE_OPENAI_API_KEY. "
        "Azure-backed NER runs will fail if selected until key is provided."
    )

# Gemini is optional until selected at runtime.
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '').strip()
if not GEMINI_API_KEY:
    logging.getLogger(__name__).warning(
        "GEMINI_API_KEY is not set. Gemini-backed NER runs will fail if selected."
    )

# Allowed providers and model choices for NER extraction runs.
NER_PROVIDER_MODEL_ALLOWLIST = {
    'groq': ['llama-3.1-8b-instant'],
    'openai': ['gpt-4o-mini', 'gpt-5-mini', 'gpt-5-nano'],
    'azure_openai': ['gpt-5-mini'],
    'gemini': ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
}

NER_DEFAULT_PROVIDER = 'groq'
NER_DEFAULT_MODEL = 'llama-3.1-8b-instant'

# Registration-based admin assignment:
# - registration is open to all users
# - auto-admin applies only to allowlisted emails within this domain
ADMIN_EMAIL_DOMAIN = os.environ.get('ADMIN_EMAIL_DOMAIN', 'undp.org').strip().lower()
ADMIN_AUTO_ADMIN_EMAILS = [
    email.strip().lower()
    for email in os.environ.get('ADMIN_AUTO_ADMIN_EMAILS', '').split(',')
    if email.strip()
]

# ─────────────────────────────────────────────────────────────────────────────
# Core settings
# ─────────────────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-insecure-secret-key-change-in-production')

# ─────────────────────────────────────────────────────────────────────────────
# Sentry — error capture and performance monitoring
# Initialised early, before Django apps load. No-ops when SENTRY_DSN is blank.
# ─────────────────────────────────────────────────────────────────────────────

_sentry_dsn = os.environ.get('SENTRY_DSN', '').strip()
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.environ.get('SENTRY_ENVIRONMENT', 'development'),
        traces_sample_rate=float(os.environ.get('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
        send_default_pii=False,
        release=os.environ.get('SENTRY_RELEASE', None),
    )

def _optional_app(name):
    try:
        import importlib
        importlib.import_module(name)
        return [name]
    except ImportError:
        return []

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.staticfiles',  # <-- required for DRF static assets
    'corsheaders',
    'rest_framework',
    'rest_framework.authtoken',
    *_optional_app('drf_spectacular'),
    *_optional_app('django_prometheus'),
    'ingestion',
    'ner',
    'reasoning',
    'graph',
]

_has_prometheus = 'django_prometheus' in INSTALLED_APPS

MIDDLEWARE = [
    *(['django_prometheus.middleware.PrometheusBeforeMiddleware'] if _has_prometheus else []),
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.gzip.GZipMiddleware',
    'django.middleware.common.CommonMiddleware',
    'stakeholder_analysis.middleware.RequestIdMiddleware',
    *(['django_prometheus.middleware.PrometheusAfterMiddleware'] if _has_prometheus else []),
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

try:
    import pythonjsonlogger  # noqa: F401
    _json_formatter = {
        '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
        'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
    }
    _console_formatter = 'json'
except ImportError:
    _json_formatter = None
    _console_formatter = 'simple'

_formatters = {
    'simple': {'format': '%(levelname)s %(name)s %(message)s'},
}
if _json_formatter:
    _formatters['json'] = _json_formatter

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': _formatters,
    'filters': {
        'request_id': {
            '()': 'stakeholder_analysis.middleware.RequestIdFilter',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': _console_formatter,
            'filters': ['request_id'],
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        # Log slow queries — DEBUG in dev, WARNING (for actual errors) in prod.
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'WARNING',
            'propagate': False,
        },
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
CORS_ALLOW_HEADERS = ['accept', 'authorization', 'content-type', 'x-requested-with', 'x-request-id']
CORS_EXPOSE_HEADERS = ['x-request-id']

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'URL_FORMAT_OVERRIDE': None,
}

# Security hardening (production-safe defaults, override via env when needed)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = _env_bool('SECURE_SSL_REDIRECT', default=not DEBUG)
SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '31536000' if not DEBUG else '0'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=not DEBUG)
SECURE_HSTS_PRELOAD = _env_bool('SECURE_HSTS_PRELOAD', default=not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = _env_bool('SECURE_CONTENT_TYPE_NOSNIFF', default=True)
X_FRAME_OPTIONS = os.environ.get('X_FRAME_OPTIONS', 'DENY')
SESSION_COOKIE_SECURE = _env_bool('SESSION_COOKIE_SECURE', default=not DEBUG)
CSRF_COOKIE_SECURE = _env_bool('CSRF_COOKIE_SECURE', default=not DEBUG)
SESSION_COOKIE_HTTPONLY = _env_bool('SESSION_COOKIE_HTTPONLY', default=True)
CSRF_COOKIE_HTTPONLY = _env_bool('CSRF_COOKIE_HTTPONLY', default=False)
SESSION_COOKIE_SAMESITE = os.environ.get('SESSION_COOKIE_SAMESITE', 'Lax')
CSRF_COOKIE_SAMESITE = os.environ.get('CSRF_COOKIE_SAMESITE', 'Lax')
_csrf_trusted_origins = os.environ.get('CSRF_TRUSTED_ORIGINS', '').strip()
if _csrf_trusted_origins:
    CSRF_TRUSTED_ORIGINS = [
        origin.strip()
        for origin in _csrf_trusted_origins.split(',')
        if origin.strip()
    ]

# Shared cache (used for generation status/polling state)
_cache_location = (
    os.environ.get('CACHE_URL')
    or os.environ.get('REDIS_URL')
    or os.environ.get('CELERY_BROKER_URL')
)

if _cache_location and ('pytest' not in sys.argv and 'test' not in sys.argv):
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': _cache_location,
            'TIMEOUT': 60 * 60,
            'KEY_PREFIX': 'stakeholder_analysis',
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'stakeholder-analysis-local-cache',
        }
    }

# ─────────────────────────────────────────────────────────────────────────────
# Rate limiting (django-ratelimit)
# ─────────────────────────────────────────────────────────────────────────────

RATELIMIT_USE_CACHE = 'default'
RATELIMIT_FAIL_OPEN = False  # Deny when cache is unavailable

# ─────────────────────────────────────────────────────────────────────────────
# OpenAPI schema (drf-spectacular)
# ─────────────────────────────────────────────────────────────────────────────

SPECTACULAR_SETTINGS = {
    'TITLE': 'Stakeholder Analysis Tool API',
    'DESCRIPTION': (
        'REST API for the UNDP Stakeholder Analysis Tool — '
        'document ingestion, NER extraction, graph queries, and AI-powered insights.'
    ),
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
}

# Celery
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', os.environ.get('REDIS_URL', 'redis://redis:6379/0'))
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', CELERY_BROKER_URL)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ALWAYS_EAGER = os.environ.get(
    'CELERY_TASK_ALWAYS_EAGER',
    'True' if ('pytest' in sys.argv or 'test' in sys.argv) else 'False',
).lower() in ('true', '1', 'yes')
CELERY_TASK_EAGER_PROPAGATES = True
