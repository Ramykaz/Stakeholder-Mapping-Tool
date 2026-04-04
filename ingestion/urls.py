"""URL routes for the ingestion app — mounted at /api/v1/."""
from django.urls import path
from ingestion.views import (
    IngestView,
    DocumentDetailView,
    ProjectListCreateView,
    ProjectDetailView,
    ProjectConceptNoteView,
    InitiativeProfileView,
    ProjectContextPreviewView,
    ExtractionGuidanceListView,
    ExtractionGuidanceDetailView,
    ExtractionGuidanceReorderView,
    WorkflowStatusView,
    ProjectDocumentUploadView,
    ProjectDocumentDetailView,
    ProjectDocumentStatusView,
)

urlpatterns = [
    path('projects/', ProjectListCreateView.as_view(), name='project-list-create'),
    path('projects/<uuid:id>/', ProjectDetailView.as_view(), name='project-detail'),
    path('projects/<uuid:id>/concept-note/', ProjectConceptNoteView.as_view(), name='project-concept-note'),
    path('projects/<uuid:id>/intake/', InitiativeProfileView.as_view(), name='project-intake'),
    path('projects/<uuid:id>/context-preview/', ProjectContextPreviewView.as_view(), name='project-context-preview'),
    path('projects/<uuid:id>/workflow/', WorkflowStatusView.as_view(), name='project-workflow-status'),
    path('projects/<uuid:id>/guidance/', ExtractionGuidanceListView.as_view(), name='project-guidance-list'),
    path('projects/<uuid:id>/guidance/<uuid:guidance_id>/', ExtractionGuidanceDetailView.as_view(), name='project-guidance-detail'),
    path('projects/<uuid:id>/guidance/reorder/', ExtractionGuidanceReorderView.as_view(), name='project-guidance-reorder'),
    path('projects/<uuid:id>/documents/', ProjectDocumentUploadView.as_view(), name='project-documents'),
    path('projects/<uuid:id>/documents/<uuid:doc_id>/', ProjectDocumentDetailView.as_view(), name='project-document-detail'),
    path('projects/<uuid:id>/documents/<uuid:doc_id>/status/', ProjectDocumentStatusView.as_view(), name='project-document-status'),
    path('documents/', IngestView.as_view(), name='ingest-document'),
    path('documents/<uuid:id>/', DocumentDetailView.as_view(), name='document-detail'),
]
