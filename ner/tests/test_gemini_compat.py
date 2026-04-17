"""Unit tests for ner.services.gemini_compat."""

from unittest.mock import MagicMock, patch


class TestIsQuotaExhausted:
    def test_billing_keyword(self):
        from ner.services.gemini_compat import _is_quota_exhausted
        assert _is_quota_exhausted('billing issue')

    def test_free_tier_keyword(self):
        from ner.services.gemini_compat import _is_quota_exhausted
        assert _is_quota_exhausted('free_tier limit reached')

    def test_upgrade_keyword(self):
        from ner.services.gemini_compat import _is_quota_exhausted
        assert _is_quota_exhausted('upgrade your plan')

    def test_rate_limit_not_quota(self):
        from ner.services.gemini_compat import _is_quota_exhausted
        assert not _is_quota_exhausted('429 rate limit exceeded')

    def test_generic_error_not_quota(self):
        from ner.services.gemini_compat import _is_quota_exhausted
        assert not _is_quota_exhausted('model not found')

    def test_empty_message_not_quota(self):
        from ner.services.gemini_compat import _is_quota_exhausted
        assert not _is_quota_exhausted('')


class TestNormalizeGeminiModel:
    def test_empty_returns_default(self):
        from ner.services.gemini_compat import normalize_gemini_model, DEFAULT_GEMINI_MODEL
        assert normalize_gemini_model('') == DEFAULT_GEMINI_MODEL

    def test_none_returns_default(self):
        from ner.services.gemini_compat import normalize_gemini_model, DEFAULT_GEMINI_MODEL
        assert normalize_gemini_model(None) == DEFAULT_GEMINI_MODEL

    def test_models_prefix_stripped(self):
        from ner.services.gemini_compat import normalize_gemini_model
        assert normalize_gemini_model('models/gemini-2.0-flash') == 'gemini-2.0-flash'

    def test_legacy_alias_resolved(self):
        from ner.services.gemini_compat import normalize_gemini_model, DEFAULT_GEMINI_MODEL
        assert normalize_gemini_model('gemini-1.5-flash') == DEFAULT_GEMINI_MODEL

    def test_legacy_pro_alias_resolved(self):
        from ner.services.gemini_compat import normalize_gemini_model, DEFAULT_GEMINI_MODEL
        assert normalize_gemini_model('gemini-1.5-pro') == DEFAULT_GEMINI_MODEL

    def test_current_model_passthrough(self):
        from ner.services.gemini_compat import normalize_gemini_model
        assert normalize_gemini_model('gemini-2.0-flash') == 'gemini-2.0-flash'

    def test_unknown_model_passthrough(self):
        from ner.services.gemini_compat import normalize_gemini_model
        assert normalize_gemini_model('custom-model-v3') == 'custom-model-v3'


class TestGenerateGeminiText:
    @patch('ner.services.gemini_compat.genai', create=True)
    def test_returns_response_text(self, mock_genai):
        import ner.services.gemini_compat as compat
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'Generated answer.'
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model

        with patch.dict('sys.modules', {'google.generativeai': mock_genai}):
            with patch('ner.services.gemini_compat.os') as mock_os:
                mock_os.environ.get.return_value = 'test-key'
                with patch('ner.services.gemini_compat.normalize_gemini_model', return_value='gemini-2.0-flash'):
                    result = compat.generate_gemini_text('Some prompt', 'gemini-2.0-flash')

        assert result == 'Generated answer.'

    @patch('ner.services.gemini_compat.genai', create=True)
    def test_falls_back_to_candidates_when_text_is_none(self, mock_genai):
        import ner.services.gemini_compat as compat
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = None
        part = MagicMock()
        part.text = 'Part text answer'
        mock_response.candidates = [MagicMock(content=MagicMock(parts=[part]))]
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model

        with patch.dict('sys.modules', {'google.generativeai': mock_genai}):
            with patch('ner.services.gemini_compat.os') as mock_os:
                mock_os.environ.get.return_value = 'test-key'
                with patch('ner.services.gemini_compat.normalize_gemini_model', return_value='gemini-2.0-flash'):
                    result = compat.generate_gemini_text('Some prompt', 'gemini-2.0-flash')

        assert result == 'Part text answer'
