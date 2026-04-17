"""Unit tests for ner/services/dedup_review.py — resolve_review_candidate."""

import pytest
from unittest.mock import MagicMock, patch
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


def _make_candidate(action=None, user=None):
    """Build a lightweight fake EntityReviewCandidate."""
    winner = MagicMock()
    winner.id = 'entity-winner'
    winner.canonical_name = 'United Nations Development Programme'

    loser = MagicMock()
    loser.id = 'entity-loser'
    loser.canonical_name = 'UNDP'
    loser.is_flagged = False

    candidate = MagicMock()
    candidate.id = 'candidate-1'
    candidate.left_entity = winner
    candidate.right_entity = loser
    candidate.status = 'pending'
    candidate.resolved_by = None
    candidate.resolved_at = None
    return candidate, winner, loser


@pytest.mark.django_db
class TestResolveMerge:
    def setup_method(self):
        self.user = User.objects.create_user(username='dedup_tester', password='pass')

    def test_merge_sets_status_merged(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, winner, loser = _make_candidate()

        with (
            patch('ner.services.dedup_review.EntityAlias') as MockAlias,
            patch('ner.services.dedup_review.Relation') as MockRelation,
        ):
            MockAlias.objects.get_or_create.return_value = (MagicMock(), True)
            MockRelation.objects.filter.return_value.update.return_value = 1

            result = resolve_review_candidate(candidate, 'merge', self.user)

        assert result.status == 'merged'

    def test_merge_aliases_loser_onto_winner(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, winner, loser = _make_candidate()

        with (
            patch('ner.services.dedup_review.EntityAlias') as MockAlias,
            patch('ner.services.dedup_review.Relation') as MockRelation,
        ):
            MockAlias.objects.get_or_create.return_value = (MagicMock(), True)
            MockRelation.objects.filter.return_value.update.return_value = 1

            resolve_review_candidate(candidate, 'merge', self.user)

        MockAlias.objects.get_or_create.assert_called_once_with(
            entity=winner,
            normalized_alias='undp',
            defaults={'alias_text': 'UNDP'},
        )

    def test_merge_flags_loser_entity(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, winner, loser = _make_candidate()

        with (
            patch('ner.services.dedup_review.EntityAlias') as MockAlias,
            patch('ner.services.dedup_review.Relation') as MockRelation,
        ):
            MockAlias.objects.get_or_create.return_value = (MagicMock(), True)
            MockRelation.objects.filter.return_value.update.return_value = 1

            resolve_review_candidate(candidate, 'merge', self.user)

        assert loser.is_flagged is True
        loser.save.assert_called_once_with(update_fields=['is_flagged'])

    def test_merge_reassigns_relations(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, winner, loser = _make_candidate()

        with (
            patch('ner.services.dedup_review.EntityAlias') as MockAlias,
            patch('ner.services.dedup_review.Relation') as MockRelation,
        ):
            MockAlias.objects.get_or_create.return_value = (MagicMock(), True)
            filter_mock = MagicMock()
            filter_mock.update.return_value = 1
            MockRelation.objects.filter.return_value = filter_mock

            resolve_review_candidate(candidate, 'merge', self.user)

        assert MockRelation.objects.filter.call_count == 2

    def test_merge_sets_resolved_by(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, winner, loser = _make_candidate()

        with (
            patch('ner.services.dedup_review.EntityAlias') as MockAlias,
            patch('ner.services.dedup_review.Relation') as MockRelation,
        ):
            MockAlias.objects.get_or_create.return_value = (MagicMock(), True)
            MockRelation.objects.filter.return_value.update.return_value = 1

            resolve_review_candidate(candidate, 'merge', self.user)

        assert candidate.resolved_by == self.user

    def test_merge_sets_resolved_at(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, winner, loser = _make_candidate()

        with (
            patch('ner.services.dedup_review.EntityAlias') as MockAlias,
            patch('ner.services.dedup_review.Relation') as MockRelation,
        ):
            MockAlias.objects.get_or_create.return_value = (MagicMock(), True)
            MockRelation.objects.filter.return_value.update.return_value = 1

            before = timezone.now()
            resolve_review_candidate(candidate, 'merge', self.user)
            after = timezone.now()

        assert candidate.resolved_at is not None
        assert before <= candidate.resolved_at <= after

    def test_merge_saves_candidate(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, winner, loser = _make_candidate()

        with (
            patch('ner.services.dedup_review.EntityAlias') as MockAlias,
            patch('ner.services.dedup_review.Relation') as MockRelation,
        ):
            MockAlias.objects.get_or_create.return_value = (MagicMock(), True)
            MockRelation.objects.filter.return_value.update.return_value = 1

            resolve_review_candidate(candidate, 'merge', self.user)

        candidate.save.assert_called_once_with(
            update_fields=['status', 'resolved_by', 'resolved_at']
        )


@pytest.mark.django_db
class TestResolveKeepSeparate:
    def setup_method(self):
        self.user = User.objects.create_user(username='dedup_keep_tester', password='pass')

    def test_keep_separate_sets_status(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, _, _ = _make_candidate()

        result = resolve_review_candidate(candidate, 'keep_separate', self.user)

        assert result.status == 'kept_separate'

    def test_keep_separate_sets_resolved_by(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, _, _ = _make_candidate()
        resolve_review_candidate(candidate, 'keep_separate', self.user)

        assert candidate.resolved_by == self.user

    def test_keep_separate_saves_candidate(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, _, _ = _make_candidate()
        resolve_review_candidate(candidate, 'keep_separate', self.user)

        candidate.save.assert_called_once()

    def test_keep_separate_does_not_modify_entities(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, winner, loser = _make_candidate()
        resolve_review_candidate(candidate, 'keep_separate', self.user)

        # Loser must not be flagged
        assert not loser.is_flagged
        loser.save.assert_not_called()


@pytest.mark.django_db
class TestResolveInvalidAction:
    def setup_method(self):
        self.user = User.objects.create_user(username='dedup_invalid_tester', password='pass')

    def test_invalid_action_raises_value_error(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, _, _ = _make_candidate()

        with pytest.raises(ValueError, match="Invalid action"):
            resolve_review_candidate(candidate, 'destroy', self.user)

    def test_invalid_action_does_not_save_candidate(self):
        from ner.services.dedup_review import resolve_review_candidate

        candidate, _, _ = _make_candidate()

        with pytest.raises(ValueError):
            resolve_review_candidate(candidate, 'approve', self.user)

        candidate.save.assert_not_called()
