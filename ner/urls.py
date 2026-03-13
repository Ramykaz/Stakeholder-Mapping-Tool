"""URL configuration for NER API endpoints."""

from django.urls import path
from . import views

urlpatterns = [
    path('documents/<uuid:id>/extract-entities/', views.ExtractEntitiesView.as_view(), name='extract-entities'),
    path('documents/<uuid:id>/entities/', views.DocumentEntitiesView.as_view(), name='document-entities'),
    path('graph/', views.GraphNodesView.as_view(), name='graph-nodes'),
]
