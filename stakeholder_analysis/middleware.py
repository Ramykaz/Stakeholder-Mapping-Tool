"""Request ID middleware for correlation tracking."""
import logging
import threading
import time
import uuid

logger = logging.getLogger(__name__)

_local = threading.local()


def get_request_id() -> str:
    return getattr(_local, 'request_id', '')


class RequestIdMiddleware:
    """Attach a unique request ID to every request and log timing + status."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get('HTTP_X_REQUEST_ID') or str(uuid.uuid4())
        _local.request_id = request_id
        request.request_id = request_id

        start = time.monotonic()
        response = self.get_response(request)
        duration_ms = int((time.monotonic() - start) * 1000)

        logger.info(
            "http_request method=%s path=%s status=%s duration_ms=%s request_id=%s",
            request.method,
            request.path,
            response.status_code,
            duration_ms,
            request_id,
        )

        response['X-Request-ID'] = request_id
        _local.request_id = ''
        return response


class RequestIdFilter(logging.Filter):
    """Inject request_id into every log record."""

    def filter(self, record):
        record.request_id = get_request_id()
        return True
