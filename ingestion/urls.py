"""URL routes for the ingestion app — mounted at /api/v1/."""
from django.urls import path
from ingestion.views import (
    IngestView,
    DocumentDetailView,
    ProjectListCreateView,
    ProjectDetailView,
    ProjectConceptNoteView,
    ProjectDocumentUploadView,
)

urlpatterns = [
    path('projects/', ProjectListCreateView.as_view(), name='project-list-create'),
    path('projects/<uuid:id>/', ProjectDetailView.as_view(), name='project-detail'),
    path('projects/<uuid:id>/concept-note/', ProjectConceptNoteView.as_view(), name='project-concept-note'),
    path('projects/<uuid:id>/documents/', ProjectDocumentUploadView.as_view(), name='project-document-upload'),
    path('documents/', IngestView.as_view(), name='ingest-document'),
    path('documents/<uuid:id>/', DocumentDetailView.as_view(), name='document-detail'),
]
