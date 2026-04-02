from __future__ import annotations

import os
import unicodedata

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def pdf_safe(text: str) -> str:
    if not text:
        return ''
    normalized = unicodedata.normalize('NFKD', str(text))
    result = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn' and ord(c) < 256)
    if len(result.strip()) < max(1, len(text.strip()) * 0.4):
        return text.encode('ascii', errors='replace').decode('ascii')
    return result or text


def resolve_pdf_fonts() -> tuple[str, str, bool]:
    font_regular = 'Helvetica'
    font_bold = 'Helvetica-Bold'

    dejavu_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    ]
    dejavu_bold_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    ]

    for path in dejavu_paths:
        try:
            if os.path.exists(path):
                pdfmetrics.registerFont(TTFont('DejaVuSans', path))
                font_regular = 'DejaVuSans'
                break
        except Exception:
            continue

    for path in dejavu_bold_paths:
        try:
            if os.path.exists(path):
                pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', path))
                font_bold = 'DejaVuSans-Bold'
                break
        except Exception:
            continue

    use_unicode = font_regular == 'DejaVuSans'
    return font_regular, font_bold, use_unicode
