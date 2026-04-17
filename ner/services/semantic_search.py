"""Semantic search over document chunk embeddings using pgvector cosine similarity."""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ingestion.models import Project

logger = logging.getLogger(__name__)

_model = None
MODEL_PATH = os.environ.get('EMBEDDING_MODEL_PATH', '/app/models/all-MiniLM-L6-v2')
FALLBACK_MODEL_NAME = 'all-MiniLM-L6-v2'
TOP_K_DEFAULT = 10


def _get_model():
    """Lazy-load the sentence-transformers model from the local volume."""
    global _model  # noqa: PLW0603
    if _model is None:
        from sentence_transformers import SentenceTransformer
        model_source = MODEL_PATH
        if MODEL_PATH.startswith('/') and not os.path.exists(MODEL_PATH):
            logger.warning(
                "Embedding model path %s not found; falling back to %s",
                MODEL_PATH,
                FALLBACK_MODEL_NAME,
            )
            model_source = FALLBACK_MODEL_NAME
        logger.info("Loading embedding model from %s", model_source)
        _model = SentenceTransformer(model_source)
    return _model


def embed_query(query: str) -> list[float]:
    """Embed a query string using the same model used during ingestion."""
    model = _get_model()
    vector = model.encode([query])[0]
    return vector.tolist()


def search_chunks(project: 'Project', query_vector: list[float], top_k: int = TOP_K_DEFAULT):
    """Return top-K Chunk objects closest to query_vector within the project's documents.

    Returns a queryset of Chunk objects annotated with distance, ordered ascending.
    """
    from pgvector.django import CosineDistance
    from ingestion.models import Chunk

    return (
        Chunk.objects.filter(document__project=project)
        .annotate(distance=CosineDistance('embedding', query_vector))
        .select_related('document')
        .order_by('distance')[:top_k]
    )


def search_entity_ids_for_project(project: 'Project', query: str, top_k: int = TOP_K_DEFAULT) -> list[str]:
    """Embed query and return entity IDs from the top-K most relevant chunks.

    Returns a list of unique entity UUIDs (as strings) ranked by chunk relevance.
    """
    from ner.models import Entity

    query_vector = embed_query(query)
    chunks = search_chunks(project, query_vector, top_k=top_k)

    chunk_ids = [c.id for c in chunks]
    if not chunk_ids:
        return []

    entity_ids = list(
        Entity.objects.filter(
            project=project,
            chunk_id__in=chunk_ids,
            is_flagged=False,
        )
        .values_list('id', flat=True)
        .distinct()
    )
    return [str(eid) for eid in entity_ids]


def search_chunks_for_entity(project: 'Project', entity_name: str, top_k: int = TOP_K_DEFAULT):
    """Return top-K chunks most relevant to an entity name, scoped to the project."""
    query_vector = embed_query(entity_name)
    return search_chunks(project, query_vector, top_k=top_k)


def compute_query_relevance_score(project: 'Project', query: str, top_k: int = 5) -> float | None:
    """Return a 0.0–1.0 relevance score for a query against the project's corpus.

    Uses the mean cosine similarity (1 - distance) of the top-K matching chunks.
    Returns None if no chunks are found.
    """
    try:
        query_vector = embed_query(query)
        chunks = search_chunks(project, query_vector, top_k=top_k)
        distances = [getattr(c, 'distance', None) for c in chunks if getattr(c, 'distance', None) is not None]
        if not distances:
            return None
        # cosine distance in pgvector is 0 (identical) to 2 (opposite)
        # cosine similarity = 1 - distance (for normalized vectors)
        scores = [max(0.0, min(1.0, 1.0 - float(d))) for d in distances]
        return round(sum(scores) / len(scores), 3)
    except Exception:  # noqa: BLE001
        return None
