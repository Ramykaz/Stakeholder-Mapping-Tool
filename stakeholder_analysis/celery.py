import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'stakeholder_analysis.settings')

app = Celery('stakeholder_analysis', include=['ingestion.tasks', 'ner.tasks'])
app.config_from_object('django.conf:settings', namespace='CELERY')
app.include = ('ingestion.tasks', 'ner.tasks')
app.conf.include = ['ingestion.tasks', 'ner.tasks']
app.autodiscover_tasks()
