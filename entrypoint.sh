#!/bin/sh
set -e

echo "Running database migrations..."
python manage.py migrate --no-input

echo "Starting gunicorn..."
exec gunicorn stakeholder_analysis.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 1 \
    --timeout 120 \
    --log-level info
