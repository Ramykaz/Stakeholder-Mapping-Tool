"""Unit tests for ner/services/pdf_utils.py — pdf_safe and resolve_pdf_fonts."""

from unittest.mock import MagicMock, patch


class TestPdfSafe:
    def test_empty_string_returns_empty(self):
        from ner.services.pdf_utils import pdf_safe
        assert pdf_safe('') == ''

    def test_none_returns_empty(self):
        from ner.services.pdf_utils import pdf_safe
        assert pdf_safe(None) == ''  # type: ignore[arg-type]

    def test_ascii_text_passes_through(self):
        from ner.services.pdf_utils import pdf_safe
        result = pdf_safe('Hello, World!')
        assert result == 'Hello, World!'

    def test_accented_characters_normalized(self):
        from ner.services.pdf_utils import pdf_safe
        # é → e after NFKD + category Mn removal
        result = pdf_safe('café')
        assert result == 'cafe'

    def test_latin_with_diacritics(self):
        from ner.services.pdf_utils import pdf_safe
        result = pdf_safe('Ação Direta')
        assert isinstance(result, str)
        assert len(result) > 0

    def test_fully_unicode_text_falls_back_to_ascii_replace(self):
        from ner.services.pdf_utils import pdf_safe
        # Purely CJK text — cannot be preserved; should fall back gracefully
        text = '你好世界'
        result = pdf_safe(text)
        # Result must be a string, not raise
        assert isinstance(result, str)

    def test_high_proportion_unicode_uses_ascii_replace(self):
        from ner.services.pdf_utils import pdf_safe
        # Emoji-heavy string: encoded/decoded through ascii replace
        text = '😀😃😄😁😆'
        result = pdf_safe(text)
        assert isinstance(result, str)

    def test_mixed_ascii_unicode_returns_sensible_result(self):
        from ner.services.pdf_utils import pdf_safe
        result = pdf_safe('UNDP Report: Données 2024')
        assert 'UNDP' in result
        assert 'Report' in result

    def test_strips_combining_marks(self):
        from ner.services.pdf_utils import pdf_safe
        # Combining grave accent U+0300 after 'a'
        text = 'a\u0300'  # à via decomposed form
        result = pdf_safe(text)
        assert result == 'a'


class TestResolvePdfFonts:
    def test_returns_helvetica_when_no_dejavu_present(self):
        from ner.services.pdf_utils import resolve_pdf_fonts
        with patch('os.path.exists', return_value=False):
            regular, bold, use_unicode = resolve_pdf_fonts()
        assert regular == 'Helvetica'
        assert bold == 'Helvetica-Bold'
        assert use_unicode is False

    def test_returns_dejavu_when_font_file_exists(self):
        from ner.services.pdf_utils import resolve_pdf_fonts

        def fake_exists(path):
            return 'DejaVuSans.ttf' in path

        with (
            patch('os.path.exists', side_effect=fake_exists),
            patch('ner.services.pdf_utils.pdfmetrics'),
            patch('ner.services.pdf_utils.TTFont', return_value=MagicMock()),
        ):
            regular, bold, use_unicode = resolve_pdf_fonts()

        assert regular == 'DejaVuSans'
        assert use_unicode is True

    def test_use_unicode_false_when_regular_font_is_helvetica(self):
        from ner.services.pdf_utils import resolve_pdf_fonts
        with patch('os.path.exists', return_value=False):
            _, _, use_unicode = resolve_pdf_fonts()
        assert use_unicode is False

    def test_font_registration_error_falls_back_gracefully(self):
        from ner.services.pdf_utils import resolve_pdf_fonts

        def raise_on_register(*args, **kwargs):
            raise RuntimeError('font error')

        with (
            patch('os.path.exists', return_value=True),
            patch('ner.services.pdf_utils.pdfmetrics'),
            patch('ner.services.pdf_utils.TTFont', side_effect=raise_on_register),
        ):
            regular, bold, use_unicode = resolve_pdf_fonts()

        # Should fall back to Helvetica without raising
        assert regular == 'Helvetica'
        assert use_unicode is False

    def test_returns_three_tuple(self):
        from ner.services.pdf_utils import resolve_pdf_fonts
        with patch('os.path.exists', return_value=False):
            result = resolve_pdf_fonts()
        assert len(result) == 3
