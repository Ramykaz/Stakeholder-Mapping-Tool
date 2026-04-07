from celery import shared_task


@shared_task(bind=True, name='ingestion.services.pipeline.process_web_source')
def process_web_source(self, web_source_id: str) -> dict:
    """Celery task wrapper for web source processing.

    Task name is pinned to the legacy value so already-dispatched producers and
    existing logs stay compatible.
    """
    from ingestion.services.web_source import process_web_source_record

    processed = process_web_source_record(web_source_id)
    return {
        'web_source_id': str(processed.id),
        'status': processed.status,
        'document_id': str(processed.document_id) if processed.document_id else None,
    }
