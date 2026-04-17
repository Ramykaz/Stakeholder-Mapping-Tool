# Model Card — Stakeholder Analysis Tool

> ISO/IEC 42001:2023 · AI system transparency documentation

---

## Embedding Model

### `all-MiniLM-L6-v2`

| Field | Value |
|-------|-------|
| Source | [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) |
| License | Apache 2.0 |
| Architecture | 6-layer MiniLM; 384-dimensional sentence embeddings |
| Parameter count | ~22M |
| Training data | 1B+ sentence pairs (MS MARCO, NLI, Wikipedia, Reddit, etc.) |
| Task | Semantic similarity / dense retrieval |

**Use in this system:** Encodes document chunks and queries for pgvector cosine similarity search. Used in the RAG pipeline to retrieve relevant context before LLM calls. Not fine-tuned on project data.

**Limitations:**
- English-centric; cross-lingual documents may yield lower retrieval quality
- Context window limited to 256 tokens; longer chunks are truncated
- No knowledge of UNDP domain-specific terminology (relies on surface similarity)

**PII handling:** The model receives document chunk text as input. No embeddings are shared externally — all inference runs inside the Docker container.

---

## LLM Providers

The system supports four interchangeable LLM providers. The active provider is configured per-project in project settings.

### Groq (Llama 3.1)

| Field | Value |
|-------|-------|
| Models | `llama-3.1-8b-instant` |
| Provider | Groq Cloud |
| Intended use | NER extraction, NL query, report generation, persona/workplan/SMQ generation |
| Data retention | Groq processes prompts but does not train on user data per their DPA |
| Known limitations | Context window 8k–128k tokens depending on model; rate limits apply |

### OpenAI (GPT-4o / GPT-5 family)

| Field | Value |
|-------|-------|
| Models | `gpt-4o-mini`, `gpt-5-mini`, `gpt-5-nano` |
| Provider | OpenAI |
| Intended use | NER extraction, NL query, advanced reasoning tasks |
| Data retention | OpenAI zero-data-retention API (when enabled on account) |
| Known limitations | Cost per token; context window limits apply |

### Azure OpenAI

| Field | Value |
|-------|-------|
| Models | GPT-4 family (deployment-configurable) |
| Provider | Microsoft Azure OpenAI Service |
| Intended use | Enterprise deployments with data residency requirements |
| Data retention | Data stays in the Azure region; no training on customer data |
| Known limitations | Requires provisioned deployment; regional availability varies |

### Gemini (Google)

| Field | Value |
|-------|-------|
| Models | `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro` |
| Provider | Google AI / Vertex AI |
| Intended use | NER extraction, NL query, report generation |
| Data retention | Per Google's API terms; enterprise Vertex AI provides data residency |
| Known limitations | JSON output formatting less consistent than GPT family |

---

## Bias and Fairness Assessment

- **Entity extraction bias:** Models may under-extract entities in non-English text or transliterated names. Stakeholder names from African, Asian, and Middle Eastern contexts may be normalised incorrectly.
- **Report generation bias:** LLMs may reflect biases present in their pre-training data when generating stakeholder analysis text. Human review is required before using AI-generated reports for decision-making.
- **No active bias monitoring** is implemented in this version. Feedback via the AI feedback endpoint can surface systematic issues.

---

## Confidence Thresholds

| Output type | Confidence threshold | Behaviour below threshold |
|-------------|----------------------|---------------------------|
| Extracted entities | 0.5 | Excluded from results |
| Extracted relationships | 0.5 | Excluded from results |
| Entity summaries | Word count < 12 | Replaced with fallback message |

---

## Limitations and Intended Use

- This tool is designed for **internal UNDP stakeholder analysis** workflows. It is not a general-purpose AI assistant.
- AI-generated content **must be reviewed** by a human analyst before use in formal reports or decision-making.
- The system applies output content filtering (regex-based) but does not guarantee the absence of hallucinations or factual errors.
- LLM responses are grounded in uploaded project documents (RAG), but the grounding is not perfect — the model may draw on pre-training knowledge.

---

## Incident Reporting

If you observe biased, harmful, or factually incorrect AI output, use the in-app feedback button or report to the system administrator. See [RUNBOOK.md](RUNBOOK.md) for escalation procedures.
