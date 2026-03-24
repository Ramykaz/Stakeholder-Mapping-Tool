"""Service layer for dedup review candidate resolution."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.utils import timezone

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser
    from ner.models import EntityReviewCandidate

logger = logging.getLogger(__name__)


def resolve_review_candidate(
    candidate: 'EntityReviewCandidate',
    action: str,
    resolved_by: 'AbstractUser',
) -> 'EntityReviewCandidate':
    """Resolve a dedup review candidate as merge or keep_separate.

    - merge: aliases the losing entity onto the winner, reassigns relations,
      flags the loser, sets candidate status=merged.
    - keep_separate: sets candidate status=kept_separate.

    Returns the updated candidate.
    """
    from ner.models import EntityAlias, Relation

    if action == 'merge':
        winner = candidate.left_entity
        loser = candidate.right_entity

        EntityAlias.objects.get_or_create(
            entity=winner,
            normalized_alias=loser.canonical_name.lower(),
            defaults={'alias_text': loser.canonical_name},
        )

        Relation.objects.filter(source_entity=loser).update(source_entity=winner)
        Relation.objects.filter(target_entity=loser).update(target_entity=winner)

        loser.is_flagged = True
        loser.save(update_fields=['is_flagged'])

        candidate.status = 'merged'
        logger.info('[DEDUP] merged entity=%s into=%s', loser.id, winner.id)

    elif action == 'keep_separate':
        candidate.status = 'kept_separate'
        logger.info('[DEDUP] kept_separate candidate=%s', candidate.id)

    else:
        raise ValueError(f"Invalid action: {action!r}. Must be 'merge' or 'keep_separate'.")

    candidate.resolved_by = resolved_by
    candidate.resolved_at = timezone.now()
    candidate.save(update_fields=['status', 'resolved_by', 'resolved_at'])
    return candidate
