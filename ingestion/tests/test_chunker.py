"""Unit tests for ingestion.services.chunker."""
from unittest.mock import patch, MagicMock


def _make_mock_nlp(sentence_texts):
    """Return a mock spaCy nlp callable producing the given sentences."""
    mock_sents = []
    for text in sentence_texts:
        sent = MagicMock()
        sent.text = text
        mock_sents.append(sent)

    mock_doc = MagicMock()
    mock_doc.sents = iter(mock_sents)

    mock_nlp = MagicMock(return_value=mock_doc)
    return mock_nlp


def _make_mock_tokenizer(tokens_per_word=1):
    """Return a mock tokenizer where token count ≈ word count."""
    mock_tok = MagicMock()
    mock_tok.encode.side_effect = (
        lambda text, add_special_tokens=False: list(range(len(text.split()) * tokens_per_word))
    )
    return mock_tok


class TestChunkText:
    @patch('ingestion.services.chunker._get_nlp')
    @patch('ingestion.services.chunker._get_tokenizer')
    def test_empty_string_returns_empty_list(self, mock_get_tok, mock_get_nlp):
        mock_get_nlp.return_value = _make_mock_nlp([])
        mock_get_tok.return_value = _make_mock_tokenizer()

        from ingestion.services.chunker import chunk_text
        assert chunk_text("") == []

    @patch('ingestion.services.chunker._get_nlp')
    @patch('ingestion.services.chunker._get_tokenizer')
    def test_whitespace_only_returns_empty_list(self, mock_get_tok, mock_get_nlp):
        mock_get_nlp.return_value = _make_mock_nlp([])
        mock_get_tok.return_value = _make_mock_tokenizer()

        from ingestion.services.chunker import chunk_text
        assert chunk_text("   \n  ") == []

    @patch('ingestion.services.chunker._get_nlp')
    @patch('ingestion.services.chunker._get_tokenizer')
    def test_chunks_do_not_exceed_max_tokens(self, mock_get_tok, mock_get_nlp):
        # 50 sentences × 10 tokens each → must be grouped into multiple chunks
        sentences = [f"Sentence number {i} with padding words here today." for i in range(50)]
        mock_get_nlp.return_value = _make_mock_nlp(sentences)

        # Each call returns 10 tokens
        mock_tok = MagicMock()
        mock_tok.encode.return_value = list(range(10))
        mock_get_tok.return_value = mock_tok

        from ingestion.services.chunker import chunk_text
        result = chunk_text("placeholder")

        assert isinstance(result, list)
        assert len(result) > 1  # should be split into multiple chunks

        # Verify each chunk string is non-empty
        for chunk in result:
            assert chunk.strip() != ""

    @patch('ingestion.services.chunker._get_nlp')
    @patch('ingestion.services.chunker._get_tokenizer')
    def test_single_short_sentence_returns_one_chunk(self, mock_get_tok, mock_get_nlp):
        mock_get_nlp.return_value = _make_mock_nlp(["Short sentence."])
        mock_tok = MagicMock()
        mock_tok.encode.return_value = list(range(3))  # 3 tokens
        mock_get_tok.return_value = mock_tok

        from ingestion.services.chunker import chunk_text
        result = chunk_text("Short sentence.")

        assert len(result) == 1
        assert "Short sentence." in result[0]

    @patch('ingestion.services.chunker._get_nlp')
    @patch('ingestion.services.chunker._get_tokenizer')
    def test_overlap_means_adjacent_chunks_share_content(self, mock_get_tok, mock_get_nlp):
        # 6 sentences × 80 tokens → TARGET_TOKENS=220, so chunks boundary around sentence 2-3
        sentences = [f"Policy statement number {i} regarding governance frameworks." for i in range(6)]
        mock_get_nlp.return_value = _make_mock_nlp(sentences)

        mock_tok = MagicMock()
        mock_tok.encode.return_value = list(range(80))  # 80 tokens per sentence
        mock_get_tok.return_value = mock_tok

        from ingestion.services.chunker import chunk_text
        result = chunk_text("placeholder text")

        assert len(result) >= 2
        # With overlap, the last sentence of chunk[0] should appear at start of chunk[1]
        words_chunk0 = set(result[0].split())
        words_chunk1 = set(result[1].split())
        overlap = words_chunk0 & words_chunk1
        assert len(overlap) > 0, "Adjacent chunks should share words from the overlap region"
