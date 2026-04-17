"""Tests for GET /health (HealthView)."""
from unittest.mock import patch
from django.db import OperationalError
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()


class TestHealthView:
    def test_healthy_returns_200_with_status(self):
        from ingestion.views import HealthView

        with patch('ingestion.views.connection') as mock_conn:
            mock_conn.ensure_connection.return_value = None  # success

            request = factory.get('/health')
            response = HealthView.as_view()(request)

        assert response.status_code == 200
        assert response.data['status'] == 'healthy'
        assert response.data['database'] == 'connected'

    def test_unhealthy_returns_503_when_db_unreachable(self):
        from ingestion.views import HealthView

        with patch('ingestion.views.connection') as mock_conn:
            mock_conn.ensure_connection.side_effect = OperationalError("connection refused")

            request = factory.get('/health')
            response = HealthView.as_view()(request)

        assert response.status_code == 503
        assert response.data['database'] == 'unreachable'

    def test_response_fields_are_exactly_status_and_database(self):
        from ingestion.views import HealthView

        with patch('ingestion.views.connection') as mock_conn:
            mock_conn.ensure_connection.return_value = None

            request = factory.get('/health')
            response = HealthView.as_view()(request)

        assert 'status' in response.data
        assert 'database' in response.data
