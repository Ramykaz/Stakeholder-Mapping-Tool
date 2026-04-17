"""Tests for ner/services/semantic_search.py."""

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def mock_model():
    model = MagicMock()
    import numpy as np
    model.encode.return_value = np.array([[0.1] * 384])
    return model


def test_embed_query_returns_list(mock_model):
    with patch('ner.services.semantic_search._get_model', return_value=mock_model):
        from ner.services.semantic_search import embed_query
        result = embed_query('test query')
        assert isinstance(result, list)
        assert len(result) == 384


def test_get_model_uses_fallback_when_path_not_found(mock_model):
    """When MODEL_PATH starts with '/' and does not exist, fall back to FALLBACK_MODEL_NAME."""
    import ner.services.semantic_search as ss

    original_model = ss._model
    ss._model = None

    try:
        with (
            patch.object(ss, 'MODEL_PATH', '/nonexistent/path'),
            patch('os.path.exists', return_value=False),
            patch('sentence_transformers.SentenceTransformer', return_value=mock_model) as MockST,
        ):
            ss._get_model()
            MockST.assert_called_once_with(ss.FALLBACK_MODEL_NAME)
    finally:
        ss._model = original_model


def test_get_model_uses_local_path_when_exists(mock_model):
    """When MODEL_PATH exists on disk, load directly from that path."""
    import ner.services.semantic_search as ss

    original_model = ss._model
    ss._model = None

    try:
        with (
            patch.object(ss, 'MODEL_PATH', '/some/real/path'),
            patch('os.path.exists', return_value=True),
            patch('sentence_transformers.SentenceTransformer', return_value=mock_model) as MockST,
        ):
            ss._get_model()
            MockST.assert_called_once_with('/some/real/path')
    finally:
        ss._model = original_model


def test_search_entity_ids_empty_project(db):
    """Empty project returns empty list."""
    from django.contrib.auth import get_user_model
    from ingestion.models import Project
    from ner.services.semantic_search import search_entity_ids_for_project

    User = get_user_model()
    user = User.objects.create_user(username='testuser_ss', password='pass')
    project = Project.objects.create(name='Test', owner=user)

    with patch('ner.services.semantic_search.embed_query', return_value=[0.0] * 384):
        result = search_entity_ids_for_project(project, 'hello')
    assert result == []
