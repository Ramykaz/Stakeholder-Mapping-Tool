"""URL configuration for stakeholder_analysis project."""
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('health', include('ingestion.urls_health')),
    path('api/v1/auth/', include('stakeholder_analysis.auth_urls')),
    path('api/v1/', include('ingestion.urls')),
    path('api/v1/', include('ner.urls')),
    # OpenAPI schema
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    # Prometheus metrics
    path('', include('django_prometheus.urls')),
]
