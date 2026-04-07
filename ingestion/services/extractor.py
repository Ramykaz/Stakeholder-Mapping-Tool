"""Text extraction service: PDF, DOCX, TXT, and Markdown → plain string."""


class ExtractionError(Exception):
    """Raised when text cannot be extracted from an uploaded file."""


def extract_text(file_obj, file_format: str) -> str:
    """
    Extract plain text from an uploaded file object.

    Args:
        file_obj: File-like object (Django UploadedFile or BytesIO).
        file_format: One of 'pdf', 'docx', 'txt', 'md'.

    Returns:
        Non-empty string of extracted text.

    Raises:
        ExtractionError: If no text could be extracted.
    """
    if file_format == 'pdf':
        text = _extract_pdf(file_obj)
    elif file_format == 'docx':
        text = _extract_docx(file_obj)
    elif file_format in ('txt', 'md'):
        text = _extract_txt(file_obj)
    else:
        raise ExtractionError(f"Unsupported file format: {file_format!r}")

    text = text.strip()
    if not text:
        raise ExtractionError(
            "No extractable text found in the uploaded document. "
            "If this is a scanned PDF, OCR is not supported in this version."
        )
    return text


def _extract_pdf(file_obj) -> str:
    import pypdf
    reader = pypdf.PdfReader(file_obj)
    pages = [page.extract_text() or '' for page in reader.pages]
    return '\n'.join(pages)


def _extract_docx(file_obj) -> str:
    import docx
    doc = docx.Document(file_obj)
    return '\n'.join(para.text for para in doc.paragraphs)


def _extract_txt(file_obj) -> str:
    content = file_obj.read()
    if isinstance(content, bytes):
        return content.decode('utf-8', errors='replace')
    return content
