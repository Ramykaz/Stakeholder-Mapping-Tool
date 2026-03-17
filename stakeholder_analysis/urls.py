"""URL configuration for stakeholder_analysis project."""
from django.urls import path, include

urlpatterns = [
    path('health', include('ingestion.urls_health')),
    path('api/v1/auth/', include('stakeholder_analysis.auth_urls')),
    path('api/v1/', include('ingestion.urls')),
    path('api/v1/', include('ner.urls')),
]
