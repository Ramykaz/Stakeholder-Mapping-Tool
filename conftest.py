"""Root conftest: shared fixtures for all tests."""
import os
import pytest
import numpy as np
from unittest.mock import MagicMock, patch

# Provide dummy env vars so settings.py can import in test environments
os.environ.setdefault('DATABASE_URL', 'postgresql://user:pass@localhost:5432/testdb')
os.environ.setdefault('DEBUG', 'True')
os.environ.setdefault('ALLOWED_HOSTS', 'localhost,127.0.0.1')
os.environ.setdefault('GROQ_API_KEY', 'test-key')


@pytest.fixture(autouse=True)
def mock_embedding_model():
    """
    Automatically applied to every test.
    Replaces the real SentenceTransformer singleton with a mock that
    returns fixed 384-dim zero vectors — no model weights needed in tests.

    Uses return_value (not side_effect) so individual tests can override
    the return value by assigning to mock_embedding_model.encode.return_value.
    """
    mock_model = MagicMock()
    mock_model.encode.return_value = np.zeros((1, 384), dtype='float32')

    with patch('ingestion.services.embedder.MODEL', mock_model):
        yield mock_model


@pytest.fixture(autouse=True)
def preserve_upload_file_sizes(monkeypatch):
    """
    Patch multipart encode/decode so that file.size set on an UploadedFile
    before request creation survives the multipart round-trip.

    DRF's MultiPartRenderer calls Django's encode_file which reads actual file
    content (ignoring .size). Django's multipart parser then sets size = actual
    bytes read. This fixture:
    1. Adds a Content-Length header per file part equal to file.size.
    2. Makes MemoryFileUploadHandler.file_complete() use that declared size.

    Django's MultiPartParser already reads per-part Content-Length from MIME
    headers and passes it to handler.new_file() → self.content_length.
    """
    import django.test.client as client_module
    from django.core.files.uploadhandler import MemoryFileUploadHandler

    original_encode_file = client_module.encode_file

    def patched_encode_file(boundary, key, file):
        lines = original_encode_file(boundary, key, file)
        if hasattr(file, 'size') and file.size is not None:
            # Insert Content-Length before the blank-line separator so Django's
            # multipart parser picks it up and passes it to new_file().
            for i, line in enumerate(lines):
                if line == b'':
                    lines.insert(i, f'Content-Length: {file.size}'.encode())
                    break
        return lines

    monkeypatch.setattr(client_module, 'encode_file', patched_encode_file)

    original_file_complete = MemoryFileUploadHandler.file_complete

    def patched_file_complete(self, file_size):
        # Prefer the declared Content-Length over actual bytes received.
        declared = getattr(self, 'content_length', None)
        if declared and declared > file_size:
            file_size = declared
        return original_file_complete(self, file_size)

    monkeypatch.setattr(MemoryFileUploadHandler, 'file_complete', patched_file_complete)
