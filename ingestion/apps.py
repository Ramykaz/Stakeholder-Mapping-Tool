"""
Ingestion app configuration.

Loads the all-MiniLM-L6-v2 SentenceTransformer singleton into
ingestion.services.embedder.MODEL during Django startup (AppConfig.ready).
"""
import os
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class IngestionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ingestion'

    _model_loaded = False  # Class-level guard against double-loading.

    def ready(self):
        if IngestionConfig._model_loaded:
            return

        model_dir = os.environ.get('HF_HOME', '/app/models')
        model_path = os.path.join(model_dir, 'all-MiniLM-L6-v2')

        if not os.path.isdir(model_path):
            logger.warning(
                "Embedding model not found at %s. "
                "Document ingestion will fail until the model is downloaded. "
                "Run the one-time download command documented in quickstart.md Step 2.",
                model_path,
            )
            return

        try:
            from sentence_transformers import SentenceTransformer
            import ingestion.services.embedder as embedder_module

            model = SentenceTransformer(model_path)
            model.eval()
            embedder_module.MODEL = model
            IngestionConfig._model_loaded = True
            logger.info("Embedding model loaded from %s", model_path)
        except Exception as exc:
            logger.error("Failed to load embedding model from %s: %s", model_path, exc)
