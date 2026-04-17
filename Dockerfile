# ─── Stage 1: builder ────────────────────────────────────────────────────────
# Install all dependencies and bake ML models into a separate layer so the
# final runtime image does not contain build tools (gcc, build-essential).
FROM python:3.11-slim AS builder

# Install build-time system dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install CPU-only torch first (saves ~600MB vs default CUDA-enabled torch)
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.6.0+cpu --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir --timeout=300 --retries=5 -r requirements.txt

# Download spaCy model
RUN pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

# ── Bake the embedding model into the image (never lost on restart) ──
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('all-MiniLM-L6-v2').save('/build/models/all-MiniLM-L6-v2')"


# ─── Stage 2: runtime ────────────────────────────────────────────────────────
# Lean production image — no build tools, no pip cache.
FROM python:3.11-slim AS runtime

# Runtime-only system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy baked ML models
COPY --from=builder /build/models /app/models
ENV HF_HOME=/app/models

WORKDIR /app

# Copy application source
COPY . .

# Entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Security: run as non-root ────────────────────────────────────────────────
RUN addgroup --system appgroup \
    && adduser --system --ingroup appgroup --no-create-home appuser \
    && chown -R appuser:appgroup /app /entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
