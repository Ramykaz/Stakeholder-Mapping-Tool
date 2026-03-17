"""Tests for baseline acronym seed data (US-06)."""

from django.test import TestCase

from ner.models import AcronymMap


class TestAcronymMapSeed(TestCase):
    def test_expected_default_acronyms_exist(self):
        expected = ['UNDP', 'WHO', 'SDG', 'UNICEF', 'FAO']
        found = AcronymMap.objects.filter(acronym__in=expected, active=True).values_list('acronym', flat=True)

        self.assertEqual(set(found), set(expected))

    def test_undp_expansion_seeded(self):
        row = AcronymMap.objects.get(acronym__iexact='UNDP')
        self.assertEqual(row.expansion, 'United Nations Development Programme')
        self.assertTrue(row.active)
