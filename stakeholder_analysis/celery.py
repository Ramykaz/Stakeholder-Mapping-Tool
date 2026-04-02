import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'stakeholder_analysis.settings')

app = Celery('stakeholder_analysis')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
