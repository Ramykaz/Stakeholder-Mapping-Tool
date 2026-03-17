"""Shared constants for US-06 entity deduplication behavior."""

from __future__ import annotations

AUTO_MERGE_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.70

PHASE_KEYWORDS = (
    "phase",
    "stage",
    "round",
)

YEAR_PATTERN = r"\b(19|20)\d{2}\b"

REVIEW_ACTION_MERGE = "merge"
REVIEW_ACTION_KEEP_SEPARATE = "keep_separate"

ALIAS_SOURCE_EXTRACTION = "extraction"
ALIAS_SOURCE_MANUAL = "manual"
ALIAS_SOURCE_ACRONYM = "acronym"
