"""URL routes for the ingestion app — mounted at /api/v1/."""
from django.urls import path
from ingestion.views import IngestView

urlpatterns = [
    path('documents/', IngestView.as_view(), name='ingest-document'),
]
