"""URL routes for the ingestion app — mounted at /api/v1/."""
from django.urls import path
from ingestion.views import IngestView, DocumentDetailView

urlpatterns = [
    path('documents/', IngestView.as_view(), name='ingest-document'),
    path('documents/<uuid:id>/', DocumentDetailView.as_view(), name='document-detail'),
]
