"""Graph endpoint edge rendering tests."""

from uuid import uuid4

from django.test import Client, TestCase

from ingestion.models import Document
from ner.models import Entity, NERRun, Relation


class TestGraphEdgesView(TestCase):
    """Validate /api/v1/graph edge payload behavior."""

    def setUp(self):
        self.client = Client()
        self.document = Document.objects.create(
            filename="graph-test.pdf",
            file_format="pdf",
            processing_status="completed",
        )
        self.run = NERRun.objects.create(
            document_id=self.document,
            provider="groq",
            model="llama-3.1-8b-instant",
            status=NERRun.STATUS_COMPLETED,
            tokens_input=0,
            tokens_output=0,
            tokens_cached=0,
            cost_usd="0.000000",
        )

    def test_graph_endpoint_includes_edges_for_documents_with_relations(self):
        source = Entity.objects.create(
            entity_type="PERSON",
            canonical_name="Alice",
            raw_mentions=["Alice"],
            confidence=0.94,
            document_id=self.document,
            run=self.run,
        )
        target = Entity.objects.create(
            entity_type="ORGANIZATION",
            canonical_name="UNDP",
            raw_mentions=["UNDP"],
            confidence=0.91,
            document_id=self.document,
            run=self.run,
        )
        relation = Relation.objects.create(
            document_id=self.document,
            run=self.run,
            source_entity=source,
            target_entity=target,
            label="WORKS_AT",
            confidence=0.88,
        )

        response = self.client.get(f"/api/v1/graph/?document_id={self.document.id}")

        assert response.status_code == 200
        data = response.json()
        assert "edges" in data
        assert len(data["edges"]) == 1
        assert data["total_edges"] == 1
        edge = data["edges"][0]["data"]
        assert edge["id"] == str(relation.id)
        assert edge["source"] == str(source.id)
        assert edge["target"] == str(target.id)
        assert edge["label"] == "WORKS_AT"

    def test_graph_endpoint_returns_empty_edges_for_entity_only_documents(self):
        Entity.objects.create(
            entity_type="PERSON",
            canonical_name="Bob",
            raw_mentions=["Bob"],
            confidence=0.9,
            document_id=self.document,
            run=self.run,
        )

        response = self.client.get(f"/api/v1/graph/?document_id={self.document.id}")

        assert response.status_code == 200
        data = response.json()
        assert "edges" in data
        assert data["edges"] == []
        assert data["total_edges"] == 0

    def test_graph_endpoint_document_not_found_still_returns_404(self):
        response = self.client.get(f"/api/v1/graph/?document_id={uuid4()}")
        assert response.status_code == 404
