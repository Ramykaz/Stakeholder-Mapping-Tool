"""Text extraction service: PDF, DOCX, TXT, and Markdown → plain string."""

import re


class ExtractionError(Exception):
    """Raised when text cannot be extracted from an uploaded file."""


_URL_RE = re.compile(r'https?://\S+|www\.\S+', re.IGNORECASE)
_MULTISPACE_RE = re.compile(r'\s{2,}')
_CODELIKE_RE = re.compile(r'[{}<>;]{2,}|\b(function|var\s|const\s|let\s|@media|\.css|\.js)\b', re.IGNORECASE)
_MARKDOWN_LINK_RE = re.compile(r'\[([^\]]+)\]\((?:https?://[^)]+)\)')
_MARKDOWN_FORMATTING_RE = re.compile(r'(\*\*|__|`|~~)')
_NAV_FRAGMENT_RE = re.compile(r'^(home|about|contact|privacy|terms|cookies?|login|sign\s*in|menu)(\s*[|/•]\s*.+)?$', re.IGNORECASE)
_SCRIPT_STYLE_RE = re.compile(r'\b(script|stylesheet|javascript|onclick|window\.|document\.)\b', re.IGNORECASE)
_HTML_TAG_RE = re.compile(r'<[^>]+>')
_CSS_LINE_RE = re.compile(r'^[.#]?[a-z0-9_-]+\s*\{[^}]*\}$', re.IGNORECASE)
_JSONISH_RE = re.compile(r'^\s*[\[{].*[\]}]\s*$', re.IGNORECASE)
_SYMBOL_HEAVY_RE = re.compile(r'^[\W_]+$')


def clean_text(text: str) -> str:
    """Normalize extracted text while preserving natural-language evidence."""
    raw = (text or '').replace('\r\n', '\n').replace('\r', '\n')
    lines = []
    for line in raw.split('\n'):
        candidate = _MARKDOWN_LINK_RE.sub(r'\1', line)
        candidate = _URL_RE.sub('', candidate)
        candidate = re.sub(r'^\s{0,3}#{1,6}\s*', '', candidate)
        candidate = re.sub(r'^\s*[-*•●▪◦‣]+\s+', '', candidate)
        candidate = _MARKDOWN_FORMATTING_RE.sub('', candidate).strip()
        if not candidate:
            continue
        if len(candidate) < 2:
            continue
        if _NAV_FRAGMENT_RE.match(candidate):
            continue
        lines.append(_MULTISPACE_RE.sub(' ', candidate))
    return '\n'.join(lines).strip()


def clean_web_text(text: str) -> str:
    """Apply stricter cleaning for web sources that include markup/script noise."""
    base = clean_text(text)
    kept = []
    for line in base.split('\n'):
        candidate = line.strip()
        if not candidate:
            continue
        if _CODELIKE_RE.search(candidate):
            continue
        if _SCRIPT_STYLE_RE.search(candidate):
            continue
        if _HTML_TAG_RE.search(candidate):
            continue
        if _CSS_LINE_RE.search(candidate):
            continue
        if _JSONISH_RE.match(candidate) and candidate.count(':') >= 1 and len(candidate.split()) <= 16:
            continue
        if _SYMBOL_HEAVY_RE.match(candidate):
            continue
        if candidate.count('|') >= 2 and len(candidate.split()) <= 10:
            continue
        kept.append(candidate)
    return '\n'.join(kept).strip()


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
