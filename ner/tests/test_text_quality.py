"""Unit tests for LLM text quality normalization helpers."""

from ner.services.text_quality import normalize_llm_text, enforce_minimum_specificity


def test_normalize_llm_text_removes_markdown_artifacts_and_lists():
    raw = "# Heading\n\n- **Point one**\n- Point *two*\n1. Third point"
    cleaned = normalize_llm_text(raw)

    assert "#" not in cleaned
    assert "**" not in cleaned
    assert "*" not in cleaned
    assert "Heading" in cleaned
    assert "Point one" in cleaned
    assert "Point two" in cleaned
    assert "Third point" in cleaned


def test_enforce_minimum_specificity_replaces_too_short_generic_text():
    cleaned = enforce_minimum_specificity("Plays a key role in this project.", entity_name="UNDP")
    assert cleaned.startswith("UNDP appears in project evidence")
