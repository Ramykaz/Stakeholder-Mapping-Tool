"""URL configuration for NER API endpoints."""

from django.urls import path
from . import views

urlpatterns = [
    path('documents/<uuid:id>/extract-entities/', views.ExtractEntitiesView.as_view(), name='extract-entities'),
    path('documents/<uuid:id>/extract-entities-relations/', views.ExtractEntitiesRelationsView.as_view(), name='extract-entities-relations'),
    path('documents/<uuid:id>/extract-relations/', views.ExtractRelationsOnlyView.as_view(), name='extract-relations-only'),
    path('documents/<uuid:id>/entities/', views.DocumentEntitiesView.as_view(), name='document-entities'),
    path('documents/<uuid:id>/relations/', views.RelationsView.as_view(), name='document-relations'),
    path('documents/<uuid:id>/runs/', views.DocumentRunsView.as_view(), name='document-runs'),
    path('documents/<uuid:id>/extraction-progress/', views.ExtractionProgressView.as_view(), name='extraction-progress'),
    path('graph/', views.GraphNodesView.as_view(), name='graph-nodes'),
]
