"""Unit tests for ingestion.services.extractor."""
import io
import pytest
from unittest.mock import patch, MagicMock

from ingestion.services.extractor import extract_text, ExtractionError


class TestExtractText:
    def test_extract_txt_returns_text(self):
        file_obj = io.BytesIO(b"Hello, world! This is plain text.")
        result = extract_text(file_obj, 'txt')
        assert result == "Hello, world! This is plain text."

    def test_extract_txt_decodes_utf8(self):
        content = "Stakeholder: José García".encode('utf-8')
        file_obj = io.BytesIO(content)
        result = extract_text(file_obj, 'txt')
        assert "José" in result

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
