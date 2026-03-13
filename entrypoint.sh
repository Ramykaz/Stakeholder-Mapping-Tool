#!/bin/sh
set -e

# Collect static files (DRF browsable API assets)
python manage.py collectstatic --noinput 2>/dev/null || true

# Run migrations
python manage.py migrate --noinput

# Start Gunicorn
exec gunicorn stakeholder_analysis.wsgi:application --bind 0.0.0.0:8000