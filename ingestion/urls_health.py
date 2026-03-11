"""Health check URL — mounted at /health (unversioned)."""
from django.urls import path
from ingestion.views import HealthView

urlpatterns = [
    path('', HealthView.as_view(), name='health'),
]
