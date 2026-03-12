"""Integration tests for NER API views."""

from unittest.mock import patch
from uuid import uuid4
from django.test import TestCase, Client
from ingestion.models import Document, Chunk
from ner.models import Entity


class TestExtractEntitiesView(TestCase):
    """Test extraction endpoint integration."""

    def setUp(self):
        """Create test client and document."""
        self.client = Client()
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
        )
        self.chunk = Chunk.objects.create(
            document=self.document,
            text="John Doe from UNDP in New York.",
            embedding=[0.0] * 384,
            chunk_index=0,
            token_count=12,
        )

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline.extract_entities_from_chunk')
    def test_extract_entities_success(self, mock_extract):
        """Test successful entity extraction returns 201."""
        mock_extract.return_value = {
            'entities': [
                {'entity_type': 'PERSON', 'text': 'John Doe', 'confidence': 0.95},
                {'entity_type': 'ORGANIZATION', 'text': 'UNDP', 'confidence': 0.98},
                {'entity_type': 'LOCATION', 'text': 'New York', 'confidence': 0.92},
            ]
        }

        url = f'/api/v1/documents/{self.document.id}/extract-entities/'
        response = self.client.post(url)

        assert response.status_code == 201
        data = response.json()
        assert data['status'] == 'extraction_completed'
        assert data['document_id'] == str(self.document.id)
        assert data['entities_created'] == 3

    def test_extract_entities_document_not_found(self):
        """Test extraction with non-existent document returns 404."""
        non_existent_id = uuid4()
        url = f'/api/v1/documents/{non_existent_id}/extract-entities/'
        response = self.client.post(url)

        assert response.status_code == 404
        data = response.json()
        assert data['error'] == 'document_not_found'

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline.extract_entities_from_chunk')
    def test_extract_entities_groq_rate_limit(self, mock_extract):
        """Test rate limit error returns 429."""
        mock_extract.side_effect = ValueError("API rate limit exceeded")

        url = f'/api/v1/documents/{self.document.id}/extract-entities/'
        response = self.client.post(url)

        assert response.status_code == 429
        data = response.json()
        assert data['error'] == 'rate_limited'

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline.extract_entities_from_chunk')
    def test_extract_entities_replaces_previous(self, mock_extract):
        """Test extraction clean-slate replacement."""
        # Create existing entities
        Entity.objects.create(
            entity_type='PERSON',
            canonical_name='Old Person',
            document_id=self.document,
            confidence=0.7,
        )

        mock_extract.return_value = {
            'entities': [
                {'entity_type': 'PERSON', 'text': 'New Person', 'confidence': 0.95},
            ]
        }

        url = f'/api/v1/documents/{self.document.id}/extract-entities/'
        response = self.client.post(url)

        assert response.status_code == 201
        data = response.json()
        assert data['entities_created'] == 1  # Not cumulative


class TestDocumentEntitiesView(TestCase):
    """Test entities retrieval endpoint integration."""

    def setUp(self):
        """Create test document with entities."""
        self.client = Client()
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
        )
        Entity.objects.create(
            entity_type='PERSON',
            canonical_name='John Doe',
            raw_mentions=['John Doe', 'John'],
            confidence=0.95,
            document_id=self.document,
        )
        Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            raw_mentions=['UNDP'],
            confidence=0.98,
            document_id=self.document,
        )

    def test_get_entities_success(self):
        """Test retrieving entities returns 200 with data."""
        url = f'/api/v1/documents/{self.document.id}/entities/'
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert data['document_id'] == str(self.document.id)
        assert len(data['entities']) == 2
        assert data['total_count'] == 2

    def test_get_entities_empty_document(self):
        """Test retrieving entities for document with no entities."""
        empty_doc = Document.objects.create(
            filename="empty.pdf",
            file_format="pdf",
            processing_status="completed",
        )

        url = f'/api/v1/documents/{empty_doc.id}/entities/'
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert data['entities'] == []
        assert data['total_count'] == 0

    def test_get_entities_document_not_found(self):
        """Test retrieving entities for non-existent document."""
        non_existent_id = uuid4()
        url = f'/api/v1/documents/{non_existent_id}/entities/'
        response = self.client.get(url)

        assert response.status_code == 404
        data = response.json()
        assert data['error'] == 'document_not_found'


class TestGraphNodesView(TestCase):
    """Test Cytoscape graph nodes endpoint integration."""

    def setUp(self):
        """Create test document with entities."""
        self.client = Client()
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
        )
        Entity.objects.create(
            entity_type='PERSON',
            canonical_name='John Doe',
            raw_mentions=['John', 'John Doe'],
            confidence=0.95,
            document_id=self.document,
        )

    def test_get_graph_nodes_success(self):
        """Test retrieving graph nodes returns 200 with Cytoscape format."""
        url = f'/api/v1/graph/?document_id={self.document.id}'
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert data['document_id'] == str(self.document.id)
        assert len(data['nodes']) == 1
        
        node = data['nodes'][0]
        assert 'id' in node
        assert 'label' in node
        assert 'data' in node
        assert node['data']['entity_type'] == 'PERSON'
        assert node['data']['raw_mentions_count'] == 2

    def test_get_graph_nodes_empty_document(self):
        """Test retrieving nodes for document with no entities."""
        empty_doc = Document.objects.create(
            filename="empty.pdf",
            file_format="pdf",
            processing_status="completed",
        )

        url = f'/api/v1/graph/?document_id={empty_doc.id}'
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert data['nodes'] == []
        assert data['total_nodes'] == 0

    def test_get_graph_nodes_missing_parameter(self):
        """Test missing document_id parameter returns 400."""
        url = '/api/v1/graph/'
        response = self.client.get(url)

        assert response.status_code == 400
        data = response.json()
        assert data['error'] == 'missing_parameter'

    def test_get_graph_nodes_document_not_found(self):
        """Test non-existent document returns 404."""
        non_existent_id = uuid4()
        url = f'/api/v1/graph/?document_id={non_existent_id}'
        response = self.client.get(url)

        assert response.status_code == 404
        data = response.json()
        assert data['error'] == 'document_not_found'
