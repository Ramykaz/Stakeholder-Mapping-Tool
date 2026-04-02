"""Priority table computation for stakeholder ranking."""

from __future__ import annotations

from django.db.models import Count

from ner.models import Entity, Relation, EngagementNote


def compute_priority_scores(project, entity_type: str | None = None) -> list[dict]:
    entities_qs = Entity.objects.filter(project=project, is_flagged=False)
    if entity_type:
        entities_qs = entities_qs.filter(entity_type__iexact=entity_type)

    entities = list(entities_qs)
    if not entities:
        return []

    entity_ids = [entity.id for entity in entities]

    source_counts = {
        row['source_entity']: row['count']
        for row in (
            Relation.objects.filter(project=project, source_entity_id__in=entity_ids)
            .values('source_entity')
            .annotate(count=Count('id'))
        )
    }
    target_counts = {
        row['target_entity']: row['count']
        for row in (
            Relation.objects.filter(project=project, target_entity_id__in=entity_ids)
            .values('target_entity')
            .annotate(count=Count('id'))
        )
    }

    note_map = {
        str(note.entity_id): note.note_text
        for note in EngagementNote.objects.filter(project=project, entity_id__in=entity_ids)
    }

    rows = []
    for entity in entities:
        degree = int(source_counts.get(entity.id, 0)) + int(target_counts.get(entity.id, 0))
        avg_confidence = float(entity.confidence or 0)
        mention_count = int(entity.mention_count_dedup or len(entity.raw_mentions or []))
        priority_score = round(degree * avg_confidence, 4)

        if priority_score >= 2.0:
            priority_level = 'high'
        elif priority_score >= 0.8:
            priority_level = 'medium'
        else:
            priority_level = 'low'

        reasoning = (
            f"Influence derives from degree {degree} and confidence {avg_confidence:.2f} "
            f"with {mention_count} mentions in project evidence."
        )
        recommended_ask = note_map.get(str(entity.id))

        rows.append(
            {
                'entity_id': str(entity.id),
                'name': entity.canonical_name,
                'category': entity.entity_type,
                'entity_type': entity.entity_type,
                'mention_count': mention_count,
                'avg_confidence': round(avg_confidence, 4),
                'degree': degree,
                'priority_score': priority_score,
                'priority_level': priority_level,
                'reasoning': reasoning,
                'recommended_ask': recommended_ask,
                'engagement_note': note_map.get(str(entity.id)),
            }
        )

    rows.sort(key=lambda item: item['priority_score'], reverse=True)
    for index, row in enumerate(rows, start=1):
        row['rank'] = index

    return rows
