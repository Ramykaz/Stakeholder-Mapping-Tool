"""Unit tests for ingestion.services.extractor."""
import io
import pytest
from unittest.mock import patch, MagicMock

from ingestion.services.extractor import extract_text, ExtractionError, clean_text, clean_web_text


class TestExtractText:
    def test_clean_text_removes_markdown_urls_and_nav_noise(self):
        raw = (
            "# Project Update\n"
            "- **UNDP** launched [program](https://example.com/program) in Accra.\n"
            "Home | About | Contact\n"
            "Visit https://example.com for details\n"
        )

        cleaned = clean_text(raw)

        assert "Project Update" in cleaned
        assert "UNDP launched program in Accra." in cleaned
        assert "Home | About | Contact" not in cleaned
        assert "https://" not in cleaned

    def test_clean_web_text_filters_script_and_navigation_fragments(self):
        raw = (
            "UNDP engages municipal authorities on flood planning.\n"
            "window.location='/next'\n"
            "home | projects | contact\n"
            "const app = {state: 'x'};\n"
            "<div class='menu'>Home</div>\n"
            ".navbar { color: #333; }\n"
            '{"menu":"home","section":"header"}\n'
        )

        cleaned = clean_web_text(raw)

        assert "UNDP engages municipal authorities on flood planning." in cleaned
        assert "window.location" not in cleaned
        assert "home | projects | contact" not in cleaned
        assert "const app" not in cleaned
        assert "<div class='menu'>" not in cleaned
        assert ".navbar { color: #333; }" not in cleaned
        assert '{"menu":"home"' not in cleaned

    def test_extract_txt_returns_text(self):
        file_obj = io.BytesIO(b"Hello, world! This is plain text.")
        result = extract_text(file_obj, 'txt')
        assert result == "Hello, world! This is plain text."

    def test_extract_txt_decodes_utf8(self):
        content = "Stakeholder: José García".encode('utf-8')
        file_obj = io.BytesIO(content)
        result = extract_text(file_obj, 'txt')
        assert "José" in result

    def test_extract_markdown_returns_text(self):
        file_obj = io.BytesIO(b"# Title\n\n- Item 1\n- Item 2")
        result = extract_text(file_obj, 'md')
        assert "Title" in result
        assert "Item 1" in result

    def test_extract_txt_empty_file_raises(self):
        file_obj = io.BytesIO(b"")
        with pytest.raises(ExtractionError, match="No extractable text"):
            extract_text(file_obj, 'txt')

    def test_extract_txt_whitespace_only_raises(self):
        file_obj = io.BytesIO(b"   \n\t  ")
        with pytest.raises(ExtractionError, match="No extractable text"):
            extract_text(file_obj, 'txt')

    def test_extract_pdf_returns_combined_page_text(self):
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Page one content."
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Page two content."

        with patch('pypdf.PdfReader') as mock_reader_cls:
            mock_reader = MagicMock()
            mock_reader.pages = [mock_page1, mock_page2]
            mock_reader_cls.return_value = mock_reader

            file_obj = io.BytesIO(b"%PDF-1.4 fake")
            result = extract_text(file_obj, 'pdf')

        assert "Page one content." in result
        assert "Page two content." in result

    def test_extract_pdf_no_text_raises(self):
        mock_page = MagicMock()
        mock_page.extract_text.return_value = ""

        with patch('pypdf.PdfReader') as mock_reader_cls:
            mock_reader = MagicMock()
            mock_reader.pages = [mock_page]
            mock_reader_cls.return_value = mock_reader

            file_obj = io.BytesIO(b"%PDF-1.4 image-only")
            with pytest.raises(ExtractionError, match="No extractable text"):
                extract_text(file_obj, 'pdf')

    def test_extract_docx_returns_paragraph_text(self):
        mock_para1 = MagicMock()
        mock_para1.text = "First paragraph."
        mock_para2 = MagicMock()
        mock_para2.text = "Second paragraph."

        with patch('docx.Document') as mock_doc_cls:
            mock_doc = MagicMock()
            mock_doc.paragraphs = [mock_para1, mock_para2]
            mock_doc_cls.return_value = mock_doc

            file_obj = io.BytesIO(b"fake docx bytes")
            result = extract_text(file_obj, 'docx')

        assert "First paragraph." in result
        assert "Second paragraph." in result

    def test_extract_docx_empty_paragraphs_raises(self):
        mock_para = MagicMock()
        mock_para.text = ""

        with patch('docx.Document') as mock_doc_cls:
            mock_doc = MagicMock()
            mock_doc.paragraphs = [mock_para]
            mock_doc_cls.return_value = mock_doc

            file_obj = io.BytesIO(b"fake docx bytes")
            with pytest.raises(ExtractionError, match="No extractable text"):
                extract_text(file_obj, 'docx')
