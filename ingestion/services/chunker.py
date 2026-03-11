"""
Semantic chunking service using spaCy sentence segmentation.

Strategy (from research.md):
- Target chunk size: 200–240 tokens (hard max: 256)
- Overlap: ~32–48 tokens between adjacent chunks
- Sentence-based: spaCy en_core_web_sm for boundary detection
- Token counting: all-MiniLM-L6-v2 tokenizer for accurate counts
"""

TARGET_TOKENS = 220   # Aim for this; stay under MAX_TOKENS
MAX_TOKENS = 256      # Hard limit — model context window
MIN_TOKENS = 50       # Chunks shorter than this are merged into a neighbour
OVERLAP_TOKENS = 40   # Approximate overlap carried into the next chunk

# Lazy singletons — loaded on first use to avoid import-time side effects.
_nlp = None
_tokenizer = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        _nlp = spacy.load('en_core_web_sm')
    return _nlp


def _get_tokenizer():
    global _tokenizer
    if _tokenizer is None:
        from transformers import AutoTokenizer
        _tokenizer = AutoTokenizer.from_pretrained(
            'sentence-transformers/all-MiniLM-L6-v2'
        )
    return _tokenizer


def count_tokens(text: str) -> int:
    """Return the number of tokens in text using the embedding model's tokenizer."""
    return len(_get_tokenizer().encode(text, add_special_tokens=False))


def chunk_text(text: str) -> list[str]:
    """
    Split text into semantic chunks suitable for all-MiniLM-L6-v2 embedding.

    Args:
        text: Plain text string (any length).

    Returns:
        List of non-empty chunk strings. Empty list if input is empty.
    """
    if not text or not text.strip():
        return []

    nlp = _get_nlp()
    doc = nlp(text)
    sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]

    if not sentences:
        return []

    chunks: list[tuple[str, int]] = []  # (text, token_count)
    current: list[str] = []
    current_tokens = 0

    for sentence in sentences:
        sent_tokens = count_tokens(sentence)

        # Oversized single sentence: flush buffer and emit as its own chunk.
        if sent_tokens > MAX_TOKENS:
            if current:
                chunks.append((' '.join(current), current_tokens))
                current, current_tokens = [], 0
            chunks.append((sentence, sent_tokens))
            continue

        # Adding this sentence would overflow target: flush current buffer.
        if current_tokens + sent_tokens > TARGET_TOKENS and current:
            chunks.append((' '.join(current), current_tokens))

            # Carry forward the last N sentences that fit within OVERLAP_TOKENS.
            overlap: list[str] = []
            overlap_tokens = 0
            for s in reversed(current):
                t = count_tokens(s)
                if overlap_tokens + t <= OVERLAP_TOKENS:
                    overlap.insert(0, s)
                    overlap_tokens += t
                else:
                    break
            current = overlap
            current_tokens = overlap_tokens

        current.append(sentence)
        current_tokens += sent_tokens

    # Flush any remaining sentences.
    if current:
        chunks.append((' '.join(current), current_tokens))

    # Merge chunks that are too short into their neighbour.
    return _merge_short_chunks(chunks)


def _merge_short_chunks(chunks: list[tuple[str, int]]) -> list[str]:
    merged: list[tuple[str, int]] = []
    for chunk_text, chunk_tokens in chunks:
        if merged and chunk_tokens < MIN_TOKENS:
            prev_text, prev_tokens = merged[-1]
            merged[-1] = (prev_text + ' ' + chunk_text, prev_tokens + chunk_tokens)
        else:
            merged.append((chunk_text, chunk_tokens))
    return [c.strip() for c, _ in merged if c.strip()]
