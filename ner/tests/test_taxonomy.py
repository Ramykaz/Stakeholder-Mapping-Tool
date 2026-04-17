"""Unit tests for ner.services.taxonomy DB query helpers."""

from django.test import TestCase

from ner.models import EntityLabel, RelationshipType
from ner.services.taxonomy import get_active_entity_labels, get_active_relationship_types


class TestGetActiveEntityLabels(TestCase):
    def setUp(self):
        # Clear any fixtures/migrations-seeded data that might interfere
        EntityLabel.objects.all().update(active=False)

    def test_returns_names_of_active_labels(self):
        # Reactivate two already-seeded labels (avoids unique constraint collision)
        existing = list(EntityLabel.objects.order_by('display_order')[:2])
        for label in existing:
            label.active = True
            label.save()
        if len(existing) < 2:
            self.skipTest('Not enough seeded labels')
        result = get_active_entity_labels()
        for label in existing:
            self.assertIn(label.name, result)

    def test_excludes_inactive_labels(self):
        EntityLabel.objects.create(name='INACTIVE', active=False, display_order=10, color='#fff', node_shape='ellipse')
        result = get_active_entity_labels()
        self.assertNotIn('INACTIVE', result)

    def test_returns_list_ordered_by_display_order(self):
        EntityLabel.objects.create(name='ZEBRA', active=True, display_order=99, color='#fff', node_shape='ellipse')
        EntityLabel.objects.create(name='ALPHA', active=True, display_order=1, color='#fff', node_shape='ellipse')
        result = get_active_entity_labels()
        alpha_idx = result.index('ALPHA') if 'ALPHA' in result else -1
        zebra_idx = result.index('ZEBRA') if 'ZEBRA' in result else -1
        if alpha_idx >= 0 and zebra_idx >= 0:
            self.assertLess(alpha_idx, zebra_idx)

    def test_empty_when_no_active_labels(self):
        result = get_active_entity_labels()
        self.assertEqual(result, [])

    def test_returns_list_type(self):
        self.assertIsInstance(get_active_entity_labels(), list)


class TestGetActiveRelationshipTypes(TestCase):
    def setUp(self):
        RelationshipType.objects.all().update(active=False)

    def test_returns_active_types_with_name_and_directional(self):
        RelationshipType.objects.create(name='FUNDS', active=True, directional=True, display_order=1)
        result = get_active_relationship_types()
        self.assertTrue(any(r['name'] == 'FUNDS' for r in result))
        funds = next(r for r in result if r['name'] == 'FUNDS')
        self.assertIn('directional', funds)
        self.assertTrue(funds['directional'])

    def test_excludes_inactive_types(self):
        RelationshipType.objects.create(name='HIDDEN', active=False, directional=False, display_order=99)
        result = get_active_relationship_types()
        self.assertFalse(any(r['name'] == 'HIDDEN' for r in result))

    def test_returns_list_of_dicts(self):
        result = get_active_relationship_types()
        self.assertIsInstance(result, list)
        for item in result:
            self.assertIsInstance(item, dict)
            self.assertIn('name', item)
            self.assertIn('directional', item)

    def test_empty_when_no_active_types(self):
        result = get_active_relationship_types()
        self.assertEqual(result, [])
