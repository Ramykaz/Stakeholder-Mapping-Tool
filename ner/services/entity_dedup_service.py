"""Reusable entity deduplication service for save-time canonicalization."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Iterable

from django.db.models import QuerySet
from django.utils import timezone
from rapidfuzz import fuzz

from ner.models import AcronymMap, Entity, EntityAlias, EntityReviewCandidate
from ner.services.entity_dedup_constants import (
    ALIAS_SOURCE_ACRONYM,
    ALIAS_SOURCE_EXTRACTION,
    AUTO_MERGE_THRESHOLD,
    PHASE_KEYWORDS,
    REVIEW_ACTION_KEEP_SEPARATE,
    REVIEW_ACTION_MERGE,
    REVIEW_THRESHOLD,
    YEAR_PATTERN,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DedupThresholds:
    auto_merge: float = AUTO_MERGE_THRESHOLD
    review: float = REVIEW_THRESHOLD


class EntityDedupService:
    """Centralized dedup logic entrypoint used by extraction pipelines."""

    def __init__(self, thresholds: DedupThresholds | None = None) -> None:
        self.thresholds = thresholds or DedupThresholds()
        self._year_regex = re.compile(YEAR_PATTERN)
        self._phase_regex = re.compile(r"\b(?:phase|stage|round)\s*[0-9ivx]+\b", re.IGNORECASE)

    def normalize_name(self, value: str | None) -> str:
        return " ".join((value or "").strip().lower().split())

    def detect_phase_variant(self, value: str | None) -> bool:
        normalized = self.normalize_name(value)
        if not normalized:
            return False
        if self._year_regex.search(normalized):
            return True
        return any(keyword in normalized for keyword in PHASE_KEYWORDS)

    def expand_acronym(self, token: str | None) -> str | None:
        acronym = (token or "").strip().upper()
        if not acronym:
            return None

        match = (
            AcronymMap.objects.filter(acronym__iexact=acronym, active=True)
            .order_by('-priority', 'acronym')
            .first()
        )
        return match.expansion if match else None

    def add_alias(self, entity: Entity, alias_text: str, source: str = ALIAS_SOURCE_EXTRACTION) -> EntityAlias | None:
        alias = (alias_text or '').strip()
        if not alias:
            return None
        normalized_alias = self.normalize_name(alias)
        if not normalized_alias:
            return None

        alias_obj, _ = EntityAlias.objects.get_or_create(
            entity=entity,
            normalized_alias=normalized_alias,
            defaults={
                'alias_text': alias,
                'source': source,
            },
        )
        return alias_obj

    def _build_candidate_index(self, entities: Iterable[Entity]) -> dict[str, list[Entity]]:
        indexed: dict[str, list[Entity]] = {}
        for entity in entities:
            indexed.setdefault(entity.entity_type, []).append(entity)
        return indexed

    def _dedup_mention_count(self, entity: Entity) -> int:
        mentions = entity.raw_mentions or []
        normalized = {self.normalize_name(mention) for mention in mentions if self.normalize_name(mention)}
        return len(normalized)

    def _merge_into_entity(
        self,
        target: Entity,
        mention_text: str,
        confidence: float,
        *,
        source: str = ALIAS_SOURCE_EXTRACTION,
    ) -> None:
        raw_mentions = target.raw_mentions or []
        if mention_text not in raw_mentions:
            raw_mentions.append(mention_text)
        target.raw_mentions = raw_mentions
        target.confidence = max(float(target.confidence), confidence)
        if not target.normalized_name:
            target.normalized_name = self.normalize_name(target.canonical_name)
        target.mention_count_dedup = self._dedup_mention_count(target)
        target.save(update_fields=['raw_mentions', 'confidence', 'normalized_name', 'mention_count_dedup'])
        self.add_alias(target, mention_text, source=source)

    def _fuzzy_score(self, left: str, right: str) -> float:
        token_sort = fuzz.token_sort_ratio(left, right) / 100.0
        partial = fuzz.partial_ratio(left, right) / 100.0
        return max(token_sort, partial)

    def _phase_parent_normalized_name(self, name: str) -> str:
        cleaned = self._phase_regex.sub(' ', name)
        cleaned = self._year_regex.sub(' ', cleaned)
        cleaned = re.sub(r"[^a-zA-Z0-9\s]", ' ', cleaned)
        return self.normalize_name(cleaned)

    def _resolve_parent_entity(
        self,
        mention_text: str,
        entity_type: str,
        exact_index: dict[tuple[str, str], Entity],
        candidates_by_type: dict[str, list[Entity]],
    ) -> Entity | None:
        if not self.detect_phase_variant(mention_text):
            return None

        parent_normalized = self._phase_parent_normalized_name(mention_text)
        if not parent_normalized:
            return None

        candidate = exact_index.get((parent_normalized, entity_type))
        if candidate:
            return candidate.parent_entity or candidate

        for existing in candidates_by_type.get(entity_type, []):
            existing_normalized = existing.normalized_name or self.normalize_name(existing.canonical_name)
            if existing_normalized == parent_normalized:
                return existing.parent_entity or existing
        return None

    def _create_review_candidate(self, document, left_entity: Entity, right_entity: Entity, score: float) -> None:
        left_id, right_id = sorted([str(left_entity.id), str(right_entity.id)])
        left = left_entity if str(left_entity.id) == left_id else right_entity
        right = right_entity if str(right_entity.id) == right_id else left_entity

        EntityReviewCandidate.objects.get_or_create(
            document=document,
            left_entity=left,
            right_entity=right,
            status=EntityReviewCandidate.STATUS_PENDING,
            defaults={
                'entity_type': left.entity_type,
                'similarity_score': score,
            },
        )

    def _has_pending_review(self, entity: Entity) -> bool:
        return EntityReviewCandidate.objects.filter(
            status=EntityReviewCandidate.STATUS_PENDING,
        ).filter(
            left_entity=entity,
        ).exists() or EntityReviewCandidate.objects.filter(
            status=EntityReviewCandidate.STATUS_PENDING,
            right_entity=entity,
        ).exists()

    def _merge_entities(self, winner: Entity, loser: Entity, *, resolved_candidate_id=None) -> None:
        winner_mentions = winner.raw_mentions or []
        loser_mentions = loser.raw_mentions or []
        merged_mentions = []
        seen = set()
        for mention in winner_mentions + loser_mentions:
            key = self.normalize_name(mention)
            if key and key not in seen:
                seen.add(key)
                merged_mentions.append(mention)

        winner.raw_mentions = merged_mentions
        winner.confidence = max(float(winner.confidence), float(loser.confidence))
        winner.mention_count_dedup = self._dedup_mention_count(winner)
        winner.needs_review = self._has_pending_review(winner)
        winner.save(update_fields=['raw_mentions', 'confidence', 'mention_count_dedup', 'needs_review'])

        for alias in loser.aliases.all():
            self.add_alias(winner, alias.alias_text, source=alias.source)
        self.add_alias(winner, loser.canonical_name, source=ALIAS_SOURCE_EXTRACTION)

        stale_left = EntityReviewCandidate.objects.filter(
            status=EntityReviewCandidate.STATUS_PENDING,
        ).filter(
            left_entity=loser,
        )
        stale_right = EntityReviewCandidate.objects.filter(
            status=EntityReviewCandidate.STATUS_PENDING,
            right_entity=loser,
        )
        if resolved_candidate_id:
            stale_left = stale_left.exclude(id=resolved_candidate_id)
            stale_right = stale_right.exclude(id=resolved_candidate_id)

        stale_left.update(
            status=EntityReviewCandidate.STATUS_RESOLVED_STALE,
            resolved_at=timezone.now(),
        )
        stale_right.update(
            status=EntityReviewCandidate.STATUS_RESOLVED_STALE,
            resolved_at=timezone.now(),
        )

        loser.delete()

    def resolve_review_candidate(
        self,
        candidate: EntityReviewCandidate,
        action: str,
        *,
        target_entity_id: str | None = None,
        user=None,
    ) -> EntityReviewCandidate:
        if candidate.status != EntityReviewCandidate.STATUS_PENDING:
            raise ValueError('Candidate is already resolved')

        if action not in (REVIEW_ACTION_MERGE, REVIEW_ACTION_KEEP_SEPARATE):
            raise ValueError('Unsupported review action')

        candidate.resolved_by = user if getattr(user, 'is_authenticated', False) else None
        candidate.resolved_at = timezone.now()

        if action == REVIEW_ACTION_MERGE:
            if target_entity_id:
                if str(candidate.left_entity_id) == str(target_entity_id):
                    winner = candidate.left_entity
                    loser = candidate.right_entity
                elif str(candidate.right_entity_id) == str(target_entity_id):
                    winner = candidate.right_entity
                    loser = candidate.left_entity
                else:
                    raise ValueError('target_entity_id must match one of the candidate entities')
            else:
                winner = candidate.left_entity
                loser = candidate.right_entity

            candidate.status = EntityReviewCandidate.STATUS_MERGED
            candidate.save(update_fields=['status', 'resolved_by', 'resolved_at'])
            self._merge_entities(winner, loser, resolved_candidate_id=candidate.id)
            return candidate
        else:
            candidate.status = EntityReviewCandidate.STATUS_KEPT_SEPARATE
            for entity in (candidate.left_entity, candidate.right_entity):
                entity.needs_review = self._has_pending_review(entity)
                entity.save(update_fields=['needs_review'])

        candidate.save(update_fields=['status', 'resolved_by', 'resolved_at'])
        return candidate

    def upsert_entities_for_save(
        self,
        extracted_entities: list[dict],
        document,
        run=None,
        existing_entities: QuerySet | None = None,
    ) -> list[Entity]:
        if existing_entities is None:
            existing_entities = Entity.objects.filter(document_id=document)

        created_entities: list[Entity] = []
        exact_index: dict[tuple[str, str], Entity] = {}

        all_existing = list(existing_entities)
        for existing in all_existing:
            normalized = existing.normalized_name or self.normalize_name(existing.canonical_name)
            exact_index[(normalized, existing.entity_type)] = existing

        candidates_by_type = self._build_candidate_index(all_existing)

        for extracted in extracted_entities:
            entity_type = str(extracted.get('entity_type', '') or '').strip().upper()
            mention_text = str(extracted.get('text', '') or '').strip().replace('\x00', '')
            if not entity_type or not mention_text:
                continue

            confidence = float(extracted.get('confidence', 0.5) or 0.5)
            confidence = max(0.0, min(1.0, confidence))
            chunk = extracted.get('chunk_id')

            normalized = self.normalize_name(mention_text)
            is_phase_variant = self.detect_phase_variant(mention_text)
            exact_key = (normalized, entity_type)
            if exact_key in exact_index:
                target = exact_index[exact_key]
                self._merge_into_entity(target, mention_text, confidence)
                logger.info(
                    '[DEDUP] decision=exact_merge type=%s mention="%s" entity_id=%s',
                    entity_type,
                    mention_text,
                    target.id,
                )
                continue

            expansion = self.expand_acronym(mention_text)
            if expansion:
                expansion_key = (self.normalize_name(expansion), entity_type)
                if expansion_key in exact_index:
                    target = exact_index[expansion_key]
                    self._merge_into_entity(target, mention_text, confidence, source=ALIAS_SOURCE_ACRONYM)
                    logger.info(
                        '[DEDUP] decision=acronym_merge type=%s mention="%s" expansion="%s" entity_id=%s',
                        entity_type,
                        mention_text,
                        expansion,
                        target.id,
                    )
                    continue

            same_type_candidates = candidates_by_type.get(entity_type, [])
            best_candidate = None
            best_score = 0.0
            for candidate in same_type_candidates:
                candidate_normalized = candidate.normalized_name or self.normalize_name(candidate.canonical_name)
                score = self._fuzzy_score(normalized, candidate_normalized)
                if score > best_score:
                    best_score = score
                    best_candidate = candidate

            if best_candidate and (not is_phase_variant) and best_score >= self.thresholds.auto_merge:
                self._merge_into_entity(best_candidate, mention_text, confidence)
                logger.info(
                    '[DEDUP] decision=fuzzy_auto_merge type=%s mention="%s" entity_id=%s score=%.4f',
                    entity_type,
                    mention_text,
                    best_candidate.id,
                    best_score,
                )
                continue

            parent_entity = self._resolve_parent_entity(
                mention_text=mention_text,
                entity_type=entity_type,
                exact_index=exact_index,
                candidates_by_type=candidates_by_type,
            )
            canonical_name = expansion or mention_text
            created = Entity.objects.create(
                entity_type=entity_type,
                canonical_name=canonical_name,
                normalized_name=self.normalize_name(canonical_name),
                raw_mentions=[mention_text],
                confidence=confidence,
                needs_review=False,
                mention_count_dedup=1,
                document_id=document,
                run=run,
                chunk_id=chunk,
                parent_entity=parent_entity,
            )
            created_entities.append(created)
            self.add_alias(created, mention_text, source=ALIAS_SOURCE_EXTRACTION)
            if expansion and self.normalize_name(expansion) != self.normalize_name(mention_text):
                self.add_alias(created, mention_text, source=ALIAS_SOURCE_ACRONYM)

            exact_index[(created.normalized_name, entity_type)] = created
            candidates_by_type.setdefault(entity_type, []).append(created)

            if best_candidate and (not is_phase_variant) and best_score >= self.thresholds.review:
                created.needs_review = True
                best_candidate.needs_review = True
                created.save(update_fields=['needs_review'])
                best_candidate.save(update_fields=['needs_review'])
                self._create_review_candidate(document, best_candidate, created, best_score)
                logger.info(
                    '[DEDUP] decision=fuzzy_review type=%s left_entity_id=%s right_entity_id=%s score=%.4f',
                    entity_type,
                    best_candidate.id,
                    created.id,
                    best_score,
                )
            else:
                logger.info(
                    '[DEDUP] decision=create_new type=%s canonical="%s" entity_id=%s',
                    entity_type,
                    canonical_name,
                    created.id,
                )
                if parent_entity:
                    logger.info(
                        '[DEDUP] decision=phase_parent_link type=%s entity_id=%s parent_entity_id=%s',
                        entity_type,
                        created.id,
                        parent_entity.id,
                    )

        return created_entities

    def seed_extracted_aliases(self, entities: Iterable[Entity]) -> None:
        for entity in entities:
            self.add_alias(entity, entity.canonical_name, source=ALIAS_SOURCE_EXTRACTION)
            expanded = self.expand_acronym(entity.canonical_name)
            if expanded and self.normalize_name(expanded) != self.normalize_name(entity.canonical_name):
                self.add_alias(entity, expanded, source=ALIAS_SOURCE_ACRONYM)
