"""URL configuration for NER API endpoints."""

from django.urls import path
from . import views

urlpatterns = [
    path('admin/entity-labels/', views.EntityLabelAdminView.as_view(), name='admin-entity-labels'),
    path('admin/entity-labels/<uuid:id>/', views.EntityLabelAdminDetailView.as_view(), name='admin-entity-labels-detail'),
    path('admin/relationship-types/', views.RelationshipTypeAdminView.as_view(), name='admin-relationship-types'),
    path('admin/relationship-types/<uuid:id>/', views.RelationshipTypeAdminDetailView.as_view(), name='admin-relationship-types-detail'),
    path('documents/<uuid:id>/extract-entities/', views.ExtractEntitiesView.as_view(), name='extract-entities'),
    path('documents/<uuid:id>/extract-entities-relations/', views.ExtractEntitiesRelationsView.as_view(), name='extract-entities-relations'),
    path('documents/<uuid:id>/extract-relations/', views.ExtractRelationsOnlyView.as_view(), name='extract-relations-only'),
    path('documents/<uuid:id>/entities/', views.DocumentEntitiesView.as_view(), name='document-entities'),
    path('documents/<uuid:id>/entities/review-candidates/', views.EntityReviewCandidatesView.as_view(), name='entity-review-candidates'),
    path('documents/<uuid:id>/entities/review-candidates/<uuid:candidate_id>/resolve/', views.EntityReviewResolveView.as_view(), name='entity-review-resolve'),
    path('documents/<uuid:id>/relations/', views.RelationsView.as_view(), name='document-relations'),
    path('documents/<uuid:id>/runs/', views.DocumentRunsView.as_view(), name='document-runs'),
    path('documents/<uuid:id>/extraction-progress/', views.ExtractionProgressView.as_view(), name='extraction-progress'),
    path('projects/<uuid:id>/extract-entities/', views.ProjectExtractEntitiesView.as_view(), name='project-extract-entities'),
    path('projects/<uuid:id>/entities/', views.ProjectEntitiesView.as_view(), name='project-entities'),
    path('projects/<uuid:id>/graph/', views.ProjectGraphView.as_view(), name='project-graph'),
    path('entities/<uuid:id>/', views.GlobalEntityProfileView.as_view(), name='global-entity-profile'),
    path('graph/', views.GraphNodesView.as_view(), name='graph-nodes'),
]
