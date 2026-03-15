FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
# Install CPU-only torch first (saves ~600MB vs default torch with CUDA)
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.6.0+cpu --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir --timeout=300 --retries=5 -r requirements.txt

# Download spaCy model
RUN pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

# ── Bake the embedding model into the image (never lost on restart) ──
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('all-MiniLM-L6-v2').save('/app/models/all-MiniLM-L6-v2')"
ENV HF_HOME=/app/models

# Copy source code
COPY . .

# Entrypoint: run migrations then start gunicorn
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
