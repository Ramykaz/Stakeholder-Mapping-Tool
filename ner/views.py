"""REST API views for NER pipeline."""

import logging
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ingestion.models import Document
from .models import Entity

logger = logging.getLogger(__name__)


def handle_groq_error(exception):
    """Convert Groq exceptions to DRF responses."""
    if hasattr(exception, 'status_code') and exception.status_code == 429:
        return Response(
            {
                'error': 'rate_limited',
                'detail': 'Groq API rate limit exceeded',
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    logger.error(f"Groq API error: {exception}")
    return Response(
        {
            'error': 'extraction_failed',
            'detail': 'Failed to extract entities from document',
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
