"""
Embedding service — wraps the all-MiniLM-L6-v2 SentenceTransformer singleton.

MODEL is set by IngestionConfig.ready() (ingestion/apps.py) at Django startup.
Tests replace MODEL via the autouse mock_embedding_model fixture in conftest.py.
"""
import numpy as np

# Module-level singleton. Set by AppConfig.ready(); None until then.
MODEL = None


class EmbeddingError(Exception):
    """Raised when embedding generation fails."""


def embed_chunks(chunks: list[str]) -> list[np.ndarray]:
    """
    Generate a 384-dimensional embedding vector for each chunk.

    Args:
        chunks: List of text strings to embed.

    Returns:
        List of numpy arrays, each of shape (384,) and dtype float32.

    Raises:
        EmbeddingError: If MODEL is not loaded or encoding fails.
    """
    if MODEL is None:
        raise EmbeddingError(
            "Embedding model not loaded. "
            "Ensure IngestionConfig.ready() has run and the model volume is mounted. "
            "See quickstart.md Step 2."
        )

    try:
        embeddings = MODEL.encode(chunks, normalize_embeddings=True)
    except Exception as exc:
        raise EmbeddingError(f"Embedding generation failed: {exc}") from exc

    result: list[np.ndarray] = []
    for i, emb in enumerate(embeddings):
        if len(emb) != 384:
            raise EmbeddingError(
                f"Unexpected embedding dimension for chunk {i}: "
                f"got {len(emb)}, expected 384."
            )
        result.append(np.array(emb, dtype='float32'))

    return result
