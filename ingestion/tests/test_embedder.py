"""Unit tests for ingestion.services.embedder."""
import pytest
import numpy as np
from unittest.mock import patch


class TestEmbedChunks:
    def test_returns_list_of_384_dim_arrays(self, mock_embedding_model):
        """embed_chunks returns one 384-dim array per input chunk."""
        mock_embedding_model.encode.return_value = np.zeros((3, 384), dtype='float32')

        from ingestion.services.embedder import embed_chunks
        result = embed_chunks(["chunk one", "chunk two", "chunk three"])

        assert len(result) == 3
        for arr in result:
            assert hasattr(arr, '__len__')
            assert len(arr) == 384

    def test_encode_called_with_all_chunks(self, mock_embedding_model):
        """SentenceTransformer.encode is called exactly once with all chunks."""
        chunks = ["first", "second", "third"]
        mock_embedding_model.encode.return_value = np.zeros((3, 384), dtype='float32')

        from ingestion.services.embedder import embed_chunks
        embed_chunks(chunks)

        mock_embedding_model.encode.assert_called_once_with(chunks, normalize_embeddings=True)

    def test_raises_embedding_error_when_model_is_none(self):
        """embed_chunks raises EmbeddingError when MODEL is not loaded."""
        with patch('ingestion.services.embedder.MODEL', None):
            from ingestion.services.embedder import embed_chunks, EmbeddingError
            with pytest.raises(EmbeddingError, match="not loaded"):
                embed_chunks(["some chunk"])

    def test_raises_embedding_error_on_wrong_dimension(self, mock_embedding_model):
        """embed_chunks raises EmbeddingError if model returns wrong dimension."""
        mock_embedding_model.encode.return_value = np.zeros((2, 128), dtype='float32')

        from ingestion.services.embedder import embed_chunks, EmbeddingError
        with pytest.raises(EmbeddingError, match="dimension"):
            embed_chunks(["chunk one", "chunk two"])

    def test_raises_embedding_error_on_model_exception(self, mock_embedding_model):
        """embed_chunks wraps unexpected model errors in EmbeddingError."""
        mock_embedding_model.encode.side_effect = RuntimeError("CUDA out of memory")

        from ingestion.services.embedder import embed_chunks, EmbeddingError
        with pytest.raises(EmbeddingError):
            embed_chunks(["chunk"])
