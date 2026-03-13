"""REST API views for NER pipeline."""

import logging
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from ingestion.models import Document
from .models import Entity
from .serializers import EntitySerializer, CytoscapeNodeSerializer
from .services.pipeline import extract_entities_for_document

logger = logging.getLogger(__name__)


def handle_groq_error(exception):
    """Convert Groq exceptions to DRF responses."""
    error_msg = str(exception).lower()
    if "rate limit" in error_msg or "429" in str(exception):
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


class ExtractEntitiesView(APIView):
    """Extract entities from a document using Groq Llama 3.
    
    POST /api/v1/documents/{id}/extract-entities/
    
    Response (201 Created):
    {
        "status": "extraction_completed",
        "document_id": "...",
        "entities_created": 8,
        "message": "Entity extraction completed. Previous entities have been replaced."
    }
    """

    def post(self, request, id):
        """Extract entities for document (synchronous)."""
        try:
            # Verify document exists
            try:
                Document.objects.get(id=id)
            except Document.DoesNotExist:
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Extract entities (synchronous)
            result = extract_entities_for_document(id)
            entities_created = result.get('entities_created', 0)

            return Response(
                {
                    'status': 'extraction_completed',
                    'document_id': str(id),
                    'entities_created': entities_created,
                    'message': 'Entity extraction completed. Previous entities have been replaced.',
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:
            # Rate limit error
            return handle_groq_error(e)
        except Exception as e:
            logger.error(f"Extraction error: {e}", exc_info=True)
            return handle_groq_error(e)


class DocumentEntitiesView(APIView):
    """Retrieve all entities for a document.
    
    GET /api/v1/documents/{id}/entities/
    
    Response (200 OK):
    {
        "document_id": "...",
        "entities": [...],
        "total_count": 5
    }
    """

    def get(self, request, id):
        """Get all entities for a document."""
        try:
            # Verify document exists
            try:
                Document.objects.get(id=id)
            except Document.DoesNotExist:
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get entities for document with optional filtering
            entities = Entity.objects.filter(document_id=id)

            # Optional: filter by entity_type
            entity_type = request.query_params.get('entity_type')
            if entity_type:
                entity_type = entity_type.upper()
                valid_types = [t[0] for t in Entity.ENTITY_TYPES]
                if entity_type not in valid_types:
                    return Response(
                        {
                            'error': 'invalid_parameter',
                            'detail': f'entity_type must be one of: {", ".join(valid_types)}',
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                entities = entities.filter(entity_type=entity_type)

            # Optional: filter by confidence_min
            confidence_min = request.query_params.get('confidence_min')
            if confidence_min is not None:
                try:
                    confidence_min = float(confidence_min)
                    entities = entities.filter(confidence__gte=confidence_min)
                except (ValueError, TypeError):
                    pass  # Ignore invalid confidence_min

            entities = entities.order_by('-created_at')
            serializer = EntitySerializer(entities, many=True)
            data = serializer.data

            return Response(
                {
                    'document_id': str(id),
                    'entities': data,
                    'total_count': len(data),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Error retrieving entities: {e}", exc_info=True)
            return Response(
                {
                    'error': 'retrieval_failed',
                    'detail': 'Failed to retrieve entities',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GraphNodesView(APIView):
    """Retrieve entities as Cytoscape.js nodes.
    
    GET /api/v1/graph/?document_id={id}
    
    Response (200 OK):
    {
        "document_id": "...",
        "nodes": [...],
        "total_nodes": 5
    }
    """

    def get(self, request):
        """Get graph nodes for a document."""
        try:
            # Get document_id from query parameters
            document_id = request.query_params.get('document_id')
            if not document_id:
                return Response(
                    {
                        'error': 'missing_parameter',
                        'detail': 'Required query parameter: document_id',
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Verify document exists
            try:
                Document.objects.get(id=document_id)
            except Document.DoesNotExist:
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {document_id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get entities and serialize as Cytoscape nodes
            entities = Entity.objects.filter(document_id=document_id)

            # Optional: filter by confidence_min
            confidence_min = request.query_params.get('confidence_min')
            if confidence_min is not None:
                try:
                    confidence_min = float(confidence_min)
                    entities = entities.filter(confidence__gte=confidence_min)
                except (ValueError, TypeError):
                    pass  # Ignore invalid confidence_min

            entities = entities.order_by('entity_type', 'canonical_name')
            serializer = CytoscapeNodeSerializer(entities, many=True)
            data = serializer.data

            return Response(
                {
                    'document_id': str(document_id),
                    'nodes': data,
                    'edges': [],
                    'total_nodes': len(data),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Error retrieving graph nodes: {e}", exc_info=True)
            return Response(
                {
                    'error': 'retrieval_failed',
                    'detail': 'Failed to retrieve graph nodes',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
