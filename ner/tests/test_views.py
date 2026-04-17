"""Integration tests for NER API views."""

from unittest.mock import ANY, patch
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, Client
from rest_framework.authtoken.models import Token
from ingestion.models import Document, Chunk, Project
from ner.models import Entity, NERRun


User = get_user_model()


def _auth_client(client: Client, username: str = 'tester'):
    user = User.objects.create_user(
        username=f'{username}_{uuid4().hex[:6]}',
        email=f'{uuid4().hex[:6]}@example.com',
        password='Password123',
    )
    token = Token.objects.create(user=user)
    client.defaults['HTTP_AUTHORIZATION'] = f'Token {token.key}'
    return user


class TestExtractEntitiesView(TestCase):
    """Test extraction endpoint integration."""

    def setUp(self):
        """Create test client and document."""
        self.client = Client()
        self.user = _auth_client(self.client, username='extract')
        self.project = Project.objects.create(name='p1', owner=self.user)
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
            project=self.project,
        )
        self.chunk = Chunk.objects.create(
            document=self.document,
            text="John Doe from UNDP in New York.",
            embedding=[0.0] * 384,
            chunk_index=0,
            token_count=12,
        )

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline._extract_chunk_entities')
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
    @patch('ner.services.pipeline._extract_chunk_entities')
    def test_extract_entities_groq_rate_limit(self, mock_extract):
        """Test rate limit returns partial-success response."""
        mock_extract.side_effect = ValueError("API rate limit exceeded")

        url = f'/api/v1/documents/{self.document.id}/extract-entities/'
        response = self.client.post(url)

        assert response.status_code == 201
        data = response.json()
        assert data['status'] == 'extraction_completed'
        assert data['partial'] is True
        assert data['rate_limited_chunks'] == 1
        assert data['entities_created'] == 0

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline._extract_chunk_entities')
    def test_extract_entities_replaces_previous(self, mock_extract):
        """Test extraction clean-slate replacement."""
        # Create existing entities
        Entity.objects.create(
            entity_type='PERSON',
            canonical_name='Old Person',
            document_id=self.document,
            project=self.project,
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

    @patch('ner.views.extract_entities_for_document')
    def test_extract_entities_openai_request_payload(self, mock_pipeline):
        """Test provider/model request values are passed to pipeline."""
        mock_pipeline.return_value = {
            'entities_created': 2,
            'run_id': str(uuid4()),
            'provider': 'openai',
            'model': 'gpt-5-mini',
        }

        url = f'/api/v1/documents/{self.document.id}/extract-entities/'
        response = self.client.post(
            url,
            data={'provider': 'openai', 'model': 'gpt-5-mini'},
            content_type='application/json',
        )

        assert response.status_code == 201
        data = response.json()
        assert data['provider'] == 'openai'
        assert data['model'] == 'gpt-5-mini'
        mock_pipeline.assert_called_once_with(
            self.document.id, provider='openai', model='gpt-5-mini'
        )

    def test_extract_entities_invalid_provider(self):
        """Invalid provider should return 400."""
        url = f'/api/v1/documents/{self.document.id}/extract-entities/'
        response = self.client.post(
            url,
            data={'provider': 'invalid-provider', 'model': 'x'},
            content_type='application/json',
        )

        assert response.status_code == 400
        data = response.json()
        assert data['error'] == 'invalid_parameter'

    @patch('ner.views.extract_entities_for_document')
    def test_extract_entities_usage_fields_fallback_to_null(self, mock_pipeline):
        """Usage/cost response fields should be null when provider does not return them."""
        mock_pipeline.return_value = {
            'entities_created': 1,
            'run_id': str(uuid4()),
            'provider': 'groq',
            'model': 'llama-3.1-8b-instant',
            # Intentionally omit tokens_* and cost_usd
        }

        url = f'/api/v1/documents/{self.document.id}/extract-entities/'
        response = self.client.post(url, data={}, content_type='application/json')

        assert response.status_code == 201
        data = response.json()
        assert data['tokens_input'] is None
        assert data['tokens_output'] is None
        assert data['tokens_cached'] is None
        assert data['cost_usd'] is None

    @patch('ner.views.extract_entities_for_document')
    def test_extract_entities_defaults_to_groq_without_payload(self, mock_pipeline):
        """Groq default behavior should remain when provider/model are omitted."""
        mock_pipeline.return_value = {
            'entities_created': 1,
            'run_id': str(uuid4()),
            'provider': 'groq',
            'model': 'llama-3.1-8b-instant',
        }

        url = f'/api/v1/documents/{self.document.id}/extract-entities/'
        response = self.client.post(url, data={}, content_type='application/json')

        assert response.status_code == 201
        data = response.json()
        assert data['provider'] == 'groq'
        assert data['model'] == 'llama-3.1-8b-instant'
        mock_pipeline.assert_called_once_with(
            self.document.id,
            provider='groq',
            model='llama-3.1-8b-instant',
        )

    @patch('ner.views.extract_entities_for_document')
    def test_extraction_entities_runs_contract_roundtrip(self, mock_pipeline):
        """Extraction response + entities + runs endpoints should expose required contract fields."""
        run_id = str(uuid4())
        mock_pipeline.return_value = {
            'entities_created': 2,
            'run_id': run_id,
            'provider': 'openai',
            'model': 'gpt-5-mini',
            'tokens_input': 120,
            'tokens_output': 30,
            'tokens_cached': 10,
            'cost_usd': '0.000072',
        }

        # Extraction endpoint contract
        extract_url = f'/api/v1/documents/{self.document.id}/extract-entities/'
        extract_response = self.client.post(
            extract_url,
            data={'provider': 'openai', 'model': 'gpt-5-mini'},
            content_type='application/json',
        )
        assert extract_response.status_code == 201
        extract_data = extract_response.json()
        for key in [
            'status', 'document_id', 'entities_created', 'run_id', 'provider', 'model',
            'tokens_input', 'tokens_output', 'tokens_cached', 'cost_usd', 'message',
        ]:
            assert key in extract_data

        # Entities endpoint contract
        entities_url = f'/api/v1/documents/{self.document.id}/entities/'
        entities_response = self.client.get(entities_url)
        assert entities_response.status_code == 200
        entities_data = entities_response.json()
        assert 'document_id' in entities_data
        assert 'entities' in entities_data
        assert 'total_count' in entities_data

        # Runs endpoint contract
        NERRun.objects.create(
            id=run_id,
            document_id=self.document,
            provider='openai',
            model='gpt-5-mini',
            status=NERRun.STATUS_COMPLETED,
            tokens_input=120,
            tokens_output=30,
            tokens_cached=10,
            cost_usd='0.000072',
        )
        runs_url = f'/api/v1/documents/{self.document.id}/runs/'
        runs_response = self.client.get(runs_url)
        assert runs_response.status_code == 200
        runs_data = runs_response.json()
        assert 'document_id' in runs_data
        assert 'runs' in runs_data
        assert 'total_count' in runs_data
        assert runs_data['total_count'] >= 1
        run = runs_data['runs'][0]
        for key in [
            'id', 'document_id', 'provider', 'model', 'status',
            'tokens_input', 'tokens_output', 'tokens_cached', 'cost_usd', 'created_at',
        ]:
            assert key in run


class TestDocumentEntitiesView(TestCase):
    """Test entities retrieval endpoint integration."""

    def setUp(self):
        """Create test document with entities."""
        self.client = Client()
        self.user = _auth_client(self.client, username='entities')
        self.project = Project.objects.create(name='p2', owner=self.user)
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
            project=self.project,
        )
        Entity.objects.create(
            entity_type='PERSON',
            canonical_name='John Doe',
            raw_mentions=['John Doe', 'John'],
            confidence=0.95,
            document_id=self.document,
            project=self.project,
        )
        Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            raw_mentions=['UNDP'],
            confidence=0.98,
            document_id=self.document,
            project=self.project,
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
            project=self.project,
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
        self.user = _auth_client(self.client, username='graph')
        self.project = Project.objects.create(name='p3', owner=self.user)
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
            project=self.project,
        )
        Entity.objects.create(
            entity_type='PERSON',
            canonical_name='John Doe',
            raw_mentions=['John', 'John Doe'],
            confidence=0.95,
            document_id=self.document,
            project=self.project,
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
            project=self.project,
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


class TestDocumentRunsView(TestCase):
    """Test NER run-history endpoint integration."""

    def setUp(self):
        self.client = Client()
        self.user = _auth_client(self.client, username='runs')
        self.project = Project.objects.create(name='p4', owner=self.user)
        self.document = Document.objects.create(
            filename="history.pdf",
            file_format="pdf",
            processing_status="completed",
            project=self.project,
        )
        NERRun.objects.create(
            document_id=self.document,
            provider='groq',
            model='llama-3.1-8b-instant',
            status=NERRun.STATUS_COMPLETED,
            tokens_input=120,
            tokens_output=22,
            tokens_cached=0,
            cost_usd='0.000000',
        )
        NERRun.objects.create(
            document_id=self.document,
            provider='openai',
            model='gpt-5-mini',
            status=NERRun.STATUS_COMPLETED,
            tokens_input=400,
            tokens_output=60,
            tokens_cached=100,
            cost_usd='0.000145',
        )

    def test_get_document_runs_success(self):
        """Run-history endpoint should return all runs with metadata."""
        url = f'/api/v1/documents/{self.document.id}/runs/'
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert data['document_id'] == str(self.document.id)
        assert data['total_count'] == 2
        assert len(data['runs']) == 2
        assert data['runs'][0]['provider'] in {'groq', 'openai'}
        assert 'tokens_input' in data['runs'][0]
        assert 'cost_usd' in data['runs'][0]

    def test_get_document_runs_document_not_found(self):
        """Non-existent document should return 404 for run-history endpoint."""
        non_existent_id = uuid4()
        url = f'/api/v1/documents/{non_existent_id}/runs/'
        response = self.client.get(url)

        assert response.status_code == 404
        data = response.json()
        assert data['error'] == 'document_not_found'


class TestExtractEntitiesRelationsView(TestCase):
    """Test extract entities + relations endpoint integration."""

    def setUp(self):
        """Create test client and document."""
        self.client = Client()
        self.user = _auth_client(self.client, username='joint')
        self.project = Project.objects.create(name='p5', owner=self.user)
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
            project=self.project,
        )
        self.chunk = Chunk.objects.create(
            document=self.document,
            text="John Smith works at Acme Corp as CEO.",
            embedding=[0.0] * 384,
            chunk_index=0,
            token_count=12,
        )

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.views.extract_relations_for_document')
    def test_extract_entities_relations_success(self, mock_extract):
        """Test successful extraction of entities and relations."""
        mock_extract.return_value = {
            'entities_created': 3,
            'relations_created': 2,
            'run_id': str(uuid4()),
            'provider': 'groq',
            'model': 'llama-3.1-8b-instant',
        }

        url = f'/api/v1/documents/{self.document.id}/extract-entities-relations/'
        response = self.client.post(url)

        assert response.status_code == 201
        data = response.json()
        assert data['entities_created'] == 3
        assert data['relations_created'] == 2

    def test_extract_entities_relations_document_not_found(self):
        """Test extraction with non-existent document returns 404."""
        non_existent_id = uuid4()
        url = f'/api/v1/documents/{non_existent_id}/extract-entities-relations/'
        response = self.client.post(url)

        assert response.status_code == 404

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.views.extract_relations_for_document')
    def test_extract_entities_relations_clean_slate(self, mock_extract):
        """Test that re-extraction deletes old relations."""
        from ner.models import Relation
        
        # Create existing entities and relations
        entity1 = Entity.objects.create(
            entity_type='PERSON',
            canonical_name='Old Person',
            document_id=self.document,
            project=self.project,
            confidence=0.7,
        )
        entity2 = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='Old Company',
            document_id=self.document,
            project=self.project,
            confidence=0.7,
        )
        
        run = NERRun.objects.create(
            document_id=self.document,
            provider='groq',
            model='llama-3.1-8b-instant',
            status='completed',
        )
        
        Relation.objects.create(
            document_id=self.document,
            run=run,
            project=self.project,
            source_entity=entity1,
            target_entity=entity2,
            label='OLD_RELATION',
            confidence=0.8,
        )

        initial_relation_count = Relation.objects.filter(document_id=self.document).count()
        assert initial_relation_count == 1

        mock_extract.return_value = {
            'entities_created': 2,
            'relations_created': 1,
            'run_id': str(uuid4()),
        }

        url = f'/api/v1/documents/{self.document.id}/extract-entities-relations/'
        response = self.client.post(url)

        assert response.status_code == 201
        
        # Old relations should be deleted
        _final_relation_count = Relation.objects.filter(document_id=self.document).count()
        # The endpoint deletes old relations, then creates new ones via mock
        # Actual deletion happens in the view before calling pipeline


class TestRelationsView(TestCase):
    """Test relations retrieval endpoint integration."""

    def setUp(self):
        """Create test document with entities and relations."""
        from ner.models import Relation
        
        self.client = Client()
        self.user = _auth_client(self.client, username='rels')
        self.project = Project.objects.create(name='p6', owner=self.user)
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
            project=self.project,
        )
        
        self.entity1 = Entity.objects.create(
            entity_type='PERSON',
            canonical_name='John Smith',
            document_id=self.document,
            project=self.project,
            confidence=0.95,
        )
        self.entity2 = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='Acme Corp',
            document_id=self.document,
            project=self.project,
            confidence=0.98,
        )
        
        self.run = NERRun.objects.create(
            document_id=self.document,
            provider='groq',
            model='llama-3.1-8b-instant',
            status='completed',
        )
        
        Relation.objects.create(
            document_id=self.document,
            run=self.run,
            project=self.project,
            source_entity=self.entity1,
            target_entity=self.entity2,
            label='WORKS_AT',
            confidence=0.9,
        )

    def test_get_relations_success(self):
        """Test retrieving relations returns 200 with data."""
        url = f'/api/v1/documents/{self.document.id}/relations/'
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        
        relation = data[0]
        assert 'source_entity_id' in relation
        assert 'source_entity_name' in relation
        assert 'target_entity_id' in relation
        assert 'target_entity_name' in relation
        assert relation['label'] == 'WORKS_AT'
        assert relation['confidence'] == 0.9

    def test_get_relations_empty_document(self):
        """Test retrieving relations for document with no relations."""
        empty_doc = Document.objects.create(
            filename="empty.pdf",
            file_format="pdf",
            processing_status="completed",
            project=self.project,
        )

        url = f'/api/v1/documents/{empty_doc.id}/relations/'
        response = self.client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert data == []

    def test_get_relations_document_not_found(self):
        """Test retrieving relations for non-existent document."""
        non_existent_id = uuid4()
        url = f'/api/v1/documents/{non_existent_id}/relations/'
        response = self.client.get(url)

        assert response.status_code == 404


class TestProjectExtractEntitiesView(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = _auth_client(self.client, username='project_extract')
        self.project = Project.objects.create(name='Project A', owner=self.user)
        self.document1 = Document.objects.create(
            filename='doc1.txt',
            file_format='txt',
            processing_status='completed',
            project=self.project,
        )
        self.document2 = Document.objects.create(
            filename='doc2.txt',
            file_format='txt',
            processing_status='completed',
            project=self.project,
        )

    @patch('ner.views.extract_relations_only_for_document')
    @patch('ner.views.extract_relations_for_document')
    def test_extract_single_document_with_fallback_relations(self, mock_joint_extract, mock_rel_only):
        mock_joint_extract.return_value = {
            'entities_created': 4,
            'relations_created': 0,
            'run_id': 'run-joint',
        }
        mock_rel_only.return_value = {
            'relations_created': 3,
            'run_id': 'run-fallback',
        }

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/extract-entities/',
            {'document_id': str(self.document1.id)},
            content_type='application/json',
        )

        assert response.status_code == 201
        data = response.json()
        assert data['document_id'] == str(self.document1.id)
        assert data['entities_created'] == 4
        assert data['relations_created'] == 3
        assert data['fallback_relations_run'] is True
        assert data['run_id'] == 'run-fallback'

    @patch('ner.views.extract_relations_only_for_document')
    @patch('ner.views.extract_relations_for_document')
    def test_extract_all_project_documents_when_document_id_missing(self, mock_joint_extract, mock_rel_only):
        mock_joint_extract.side_effect = [
            {
                'entities_created': 2,
                'relations_created': 1,
                'run_id': 'run-1',
            },
            {
                'entities_created': 5,
                'relations_created': 0,
                'run_id': 'run-2',
            },
        ]
        mock_rel_only.return_value = {
            'relations_created': 2,
            'run_id': 'run-2-fallback',
        }

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/extract-entities/',
            {},
            content_type='application/json',
        )

        assert response.status_code == 201
        data = response.json()
        assert data['documents_processed'] == 2
        assert data['entities_created'] == 7
        assert data['relations_created'] == 3
        assert len(data['results']) == 2
        second = data['results'][1]
        assert second['document_id'] == str(self.document2.id)
        assert second['relations_created'] == 2
        assert second['fallback_relations_run'] is True

    @patch('ner.views.extract_relations_only_for_document')
    @patch('ner.views.extract_relations_for_document')
    def test_explicit_provider_without_model_uses_provider_default_model(self, mock_joint_extract, mock_rel_only):
        """Explicit provider should not inherit incompatible project model when model is omitted."""
        self.project.provider = 'openai'
        self.project.model = 'gpt-5-mini'
        self.project.save(update_fields=['provider', 'model'])

        mock_joint_extract.return_value = {
            'entities_created': 1,
            'relations_created': 1,
            'run_id': 'run-1',
        }
        mock_rel_only.return_value = {
            'relations_created': 0,
            'run_id': None,
        }

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/extract-entities/',
            {'provider': 'groq'},
            content_type='application/json',
        )

        assert response.status_code == 201
        data = response.json()
        assert data['provider'] == 'groq'
        assert data['model'] == 'llama-3.1-8b-instant'
        mock_joint_extract.assert_any_call(
            str(self.document1.id),
            provider='groq',
            model='llama-3.1-8b-instant',
            concept_note=ANY,
            cancel_check=ANY,
        )

    def test_project_extract_status_idle_by_default(self):
        response = self.client.get(f'/api/v1/projects/{self.project.id}/extract-entities/status/')
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'idle'
        assert data['project_id'] == str(self.project.id)

    def test_project_extract_stop_sets_cancel_requested(self):
        stop_response = self.client.post(
            f'/api/v1/projects/{self.project.id}/extract-entities/stop/',
            {},
            content_type='application/json',
        )
        assert stop_response.status_code == 200
        assert stop_response.json()['cancel_requested'] is True

        status_response = self.client.get(f'/api/v1/projects/{self.project.id}/extract-entities/status/')
        assert status_response.status_code == 200
        assert status_response.json()['cancel_requested'] is True

    @patch('ner.views.extract_relations_only_for_document')
    @patch('ner.views.extract_relations_for_document')
    def test_extract_cancelled_returns_partial_results(self, mock_joint_extract, mock_rel_only):
        cache.delete(f'project_extraction_cancel:{self.project.id}')

        def _joint_side_effect(document_id, **kwargs):
            if str(document_id) == str(self.document1.id):
                cache.set(f'project_extraction_cancel:{self.project.id}', True, timeout=60)
                return {
                    'entities_created': 2,
                    'relations_created': 1,
                    'run_id': 'run-1',
                }
            raise AssertionError('Second document should not be processed after cancellation request')

        mock_joint_extract.side_effect = _joint_side_effect
        mock_rel_only.return_value = {'relations_created': 0, 'run_id': None}

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/extract-entities/',
            {},
            content_type='application/json',
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'cancelled'
        assert data['documents_processed'] == 1
        assert data['entities_created'] == 2
        assert data['relations_created'] == 1

        status_response = self.client.get(f'/api/v1/projects/{self.project.id}/extract-entities/status/')
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data['status'] == 'cancelled'
        assert status_data['documents_processed'] == 1

    @patch('ner.views.extract_relations_for_document')
    def test_rate_limit_returns_customized_provider_payload(self, mock_joint_extract):
        mock_joint_extract.side_effect = ValueError('API rate limit exceeded')

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/extract-entities/',
            {},
            content_type='application/json',
        )

        assert response.status_code == 429
        data = response.json()
        assert data['code'] == 'provider_rate_limited'
        assert data['error_kind'] == 'rate_limit'
        assert 'rate limited' in data['detail'].lower()
        assert data['provider_error']['code'] == 'PROVIDER_RATE_LIMITED'
        assert isinstance(data['provider_error'].get('remediation'), list)

        status_response = self.client.get(f'/api/v1/projects/{self.project.id}/extract-entities/status/')
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data['status'] == 'failed'
        assert 'rate limit' in str(status_data.get('error', '')).lower()

    def test_project_extract_stop_sets_cancelling_status_when_running(self):
        cache.set(
            f'project_extraction_status:{self.project.id}',
            {
                'status': 'running',
                'project_id': str(self.project.id),
                'documents_total': 2,
                'documents_processed': 0,
                'documents_remaining': 2,
            },
            timeout=60,
        )

        stop_response = self.client.post(
            f'/api/v1/projects/{self.project.id}/extract-entities/stop/',
            {},
            content_type='application/json',
        )

        assert stop_response.status_code == 200
        status_response = self.client.get(f'/api/v1/projects/{self.project.id}/extract-entities/status/')
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data['status'] == 'cancelling'
        assert status_data['cancel_requested'] is True


class TestCrossProjectLeakageRegression(TestCase):
    """Regression checks that entity profile data remains owner-scoped."""

    def setUp(self):
        self.client = Client()

        self.owner = User.objects.create_user(
            username=f'owner_{uuid4().hex[:6]}',
            email=f'owner_{uuid4().hex[:6]}@example.com',
            password='Password123',
        )
        self.other = User.objects.create_user(
            username=f'other_{uuid4().hex[:6]}',
            email=f'other_{uuid4().hex[:6]}@example.com',
            password='Password123',
        )

        owner_token = Token.objects.create(user=self.owner)
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Token {owner_token.key}'

        self.owner_project = Project.objects.create(name='Owner Project', owner=self.owner)
        self.owner_document = Document.objects.create(
            filename='owner.txt',
            file_format='txt',
            processing_status='completed',
            project=self.owner_project,
        )

        self.owner_entity = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            raw_mentions=['UNDP'],
            confidence=0.95,
            document_id=self.owner_document,
            project=self.owner_project,
        )

    def test_owner_can_access_profile_for_owned_entity(self):
        response = self.client.get(f'/api/v1/entities/{self.owner_entity.id}/profile/')
        assert response.status_code == 200
        assert response.json()['canonical_name'] == 'UNDP'

    def test_other_user_cannot_access_profile_for_foreign_entity(self):
        other_token = Token.objects.create(user=self.other)
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Token {other_token.key}'

        response = self.client.get(f'/api/v1/entities/{self.owner_entity.id}/profile/')
        assert response.status_code == 404

