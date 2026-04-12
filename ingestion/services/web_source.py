"""Web source ingestion service for URL, crawl, and pasted text inputs."""

from __future__ import annotations

from collections import deque
import unicodedata
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from ingestion.models import WebSource
from ingestion.services.pipeline import ingest_text_document
from ingestion.services.extractor import clean_web_text

MAX_CRAWL_PAGES = 20
REQUEST_TIMEOUT = 20.0
REQUEST_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}


def _sanitize_url(url: str) -> str:
    raw = (url or '').strip()
    return ''.join(char for char in raw if not unicodedata.category(char).startswith('C'))


def _blocked_access_message(url: str, status_code: int) -> str:
    return (
        f"Website blocked automated access (HTTP {status_code}) for {url}. "
        "Try using Paste Text for this page, or use a different source URL that allows bot access."
    )


def _extract_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html or '', 'html.parser')
    for tag in soup(['script', 'style', 'noscript']):
        tag.extract()
    text = soup.get_text(separator='\n')
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return '\n'.join(lines)


def _fetch_url_text(url: str) -> tuple[str, str]:
    normalized_url = _sanitize_url(url)
    with httpx.Client(timeout=REQUEST_TIMEOUT, follow_redirects=True, headers=REQUEST_HEADERS) as client:
        response = client.get(normalized_url)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if response.status_code in {401, 403}:
                raise ValueError(_blocked_access_message(normalized_url, response.status_code)) from exc
            raise
        html = response.text
    text = _extract_text_from_html(html)
    title = ''
    try:
        soup = BeautifulSoup(html, 'html.parser')
        title = (soup.title.string or '').strip() if soup.title else ''
    except Exception:
        title = ''
    return text, title


def _crawl_same_domain(root_url: str, depth: int) -> tuple[str, int, str]:
    root_url = _sanitize_url(root_url)
    parsed_root = urlparse(root_url)
    root_host = parsed_root.netloc

    queue: deque[tuple[str, int]] = deque([(root_url, 0)])
    visited: set[str] = set()
    snippets: list[str] = []
    best_title = ''

    with httpx.Client(timeout=REQUEST_TIMEOUT, follow_redirects=True, headers=REQUEST_HEADERS) as client:
        while queue and len(visited) < MAX_CRAWL_PAGES:
            current_url, current_depth = queue.popleft()
            if current_url in visited:
                continue
            visited.add(current_url)

            try:
                response = client.get(current_url)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                if current_url == root_url and response.status_code in {401, 403}:
                    raise ValueError(_blocked_access_message(root_url, response.status_code)) from exc
                continue
            except Exception:
                continue

            html = response.text
            text = _extract_text_from_html(html)
            if text:
                snippets.append(f"# Source: {current_url}\n{text}")

            if not best_title:
                try:
                    soup_title = BeautifulSoup(html, 'html.parser')
                    best_title = (soup_title.title.string or '').strip() if soup_title.title else ''
                except Exception:
                    best_title = ''

            if current_depth >= depth:
                continue

            soup = BeautifulSoup(html, 'html.parser')
            for anchor in soup.find_all('a', href=True):
                href = (anchor.get('href') or '').strip()
                if not href:
                    continue
                next_url = urljoin(current_url, href)
                parsed_next = urlparse(next_url)
                if parsed_next.scheme not in {'http', 'https'}:
                    continue
                if parsed_next.netloc != root_host:
                    continue
                normalized = parsed_next._replace(fragment='').geturl()
                if normalized in visited:
                    continue
                queue.append((normalized, current_depth + 1))

    return ('\n\n---\n\n'.join(snippets), len(visited), best_title)


def process_web_source_record(web_source_id: str) -> WebSource:
    web_source = WebSource.objects.select_related('project').get(id=web_source_id)
    web_source.status = WebSource.STATUS_PROCESSING
    web_source.error_message = ''
    web_source.save(update_fields=['status', 'error_message', 'updated_at'])

    try:
        source_type = (web_source.source_type or '').lower()

        if source_type == WebSource.SOURCE_PASTE:
            raw_text = (web_source.raw_text or '').strip()
            title = (web_source.title or '').strip() or 'Pasted notes'
            page_count = 1
        elif source_type == WebSource.SOURCE_URL:
            raw_text, fetched_title = _fetch_url_text(web_source.url)
            title = (web_source.title or fetched_title or web_source.url or 'Web source').strip()
            page_count = 1
        elif source_type == WebSource.SOURCE_CRAWL:
            raw_text, crawled_pages, fetched_title = _crawl_same_domain(
                web_source.url,
                max(1, min(2, int(web_source.crawl_depth or 1))),
            )
            title = (web_source.title or fetched_title or web_source.url or 'Crawled source').strip()
            page_count = crawled_pages
        else:
            raise ValueError('Unsupported web source type')

        raw_text = (raw_text or '').strip()
        cleaned_text = clean_web_text(raw_text)
        if not cleaned_text:
            raise ValueError('No extractable text found for this web source')

        document = ingest_text_document(raw_text, f"{title}.txt", project=web_source.project, is_web_source=True)

        web_source.raw_text = raw_text
        web_source.title = title[:255]
        web_source.page_count = page_count
        web_source.character_count = len(cleaned_text)
        web_source.document = document
        web_source.status = WebSource.STATUS_PROCESSED
        web_source.error_message = ''
        web_source.save(
            update_fields=[
                'raw_text',
                'title',
                'page_count',
                'character_count',
                'document',
                'status',
                'error_message',
                'updated_at',
            ]
        )
    except Exception as exc:
        web_source.status = WebSource.STATUS_ERROR
        web_source.error_message = str(exc)[:2000]
        web_source.save(update_fields=['status', 'error_message', 'updated_at'])

    return web_source
