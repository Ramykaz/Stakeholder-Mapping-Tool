"""Unit tests for pure functions in ner/services/report_export.py."""

import pytest


class TestParseSectionText:
    """Tests for _parse_section_text — parses LLM-generated markdown into typed blocks."""

    def _parse(self, text):
        from ner.services.report_export import _parse_section_text
        return _parse_section_text(text)

    def test_empty_string_returns_empty_list(self):
        assert self._parse('') == []

    def test_none_returns_empty_list(self):
        assert self._parse(None) == []

    def test_plain_paragraph(self):
        blocks = self._parse('This is a simple paragraph.')
        assert len(blocks) == 1
        assert blocks[0]['type'] == 'paragraph'
        assert blocks[0]['text'] == 'This is a simple paragraph.'

    def test_bullet_with_dash(self):
        blocks = self._parse('- First item')
        assert len(blocks) == 1
        assert blocks[0]['type'] == 'bullet'
        assert blocks[0]['text'] == 'First item'

    def test_bullet_with_asterisk(self):
        blocks = self._parse('* Star bullet')
        assert any(b['type'] == 'bullet' for b in blocks)

    def test_numbered_list_item(self):
        blocks = self._parse('1. First item\n2. Second item')
        bullets = [b for b in blocks if b['type'] == 'bullet']
        assert len(bullets) == 2

    def test_markdown_heading_becomes_subheading(self):
        blocks = self._parse('## Section Title')
        assert len(blocks) == 1
        assert blocks[0]['type'] == 'subheading'
        assert blocks[0]['text'] == 'Section Title'

    def test_h1_heading_becomes_subheading(self):
        blocks = self._parse('# Top Heading')
        assert blocks[0]['type'] == 'subheading'

    def test_bold_markers_stripped_from_lines(self):
        blocks = self._parse('**Bold text** appears here')
        assert 'Bold text appears here' in blocks[0]['text']
        assert '**' not in blocks[0]['text']

    def test_colon_ending_short_line_becomes_subheading(self):
        blocks = self._parse('Key findings:')
        assert blocks[0]['type'] == 'subheading'

    def test_mixed_content(self):
        text = "## Overview\n\nSome intro text.\n\n- Bullet one\n- Bullet two"
        blocks = self._parse(text)
        types = [b['type'] for b in blocks]
        assert 'subheading' in types
        assert 'paragraph' in types
        assert 'bullet' in types

    def test_multiple_paragraphs_separated_by_blank_lines(self):
        text = "First para.\n\nSecond para."
        blocks = self._parse(text)
        paragraphs = [b for b in blocks if b['type'] == 'paragraph']
        assert len(paragraphs) == 2

    def test_windows_line_endings_handled(self):
        blocks = self._parse('Line one\r\nLine two')
        assert len(blocks) >= 1


class TestSanitizeExportNarrative:
    """Tests for _sanitize_export_narrative — strips internal doc references."""

    def _sanitize(self, text):
        from ner.services.report_export import _sanitize_export_narrative
        return _sanitize_export_narrative(text)

    def test_empty_returns_empty(self):
        assert self._sanitize('') == ''

    def test_none_returns_empty(self):
        assert self._sanitize(None) == ''

    def test_plain_text_unchanged(self):
        result = self._sanitize('This is clean narrative text.')
        assert result == 'This is clean narrative text.'

    def test_strips_doc_citation(self):
        text = 'Key finding [Doc: document1.pdf] supports this claim.'
        result = self._sanitize(text)
        assert '[Doc:' not in result
        assert 'Key finding' in result
        assert 'supports this claim' in result

    def test_strips_doc_citation_case_insensitive(self):
        text = 'As noted [DOC: report.pdf] in the analysis.'
        result = self._sanitize(text)
        assert '[DOC:' not in result

    def test_strips_smq_answer_reference(self):
        text = 'See SMQ_Answer.md for context.'
        result = self._sanitize(text)
        assert 'SMQ_Answer.md' not in result

    def test_strips_project_context_reference(self):
        text = 'Refer to Project_Context.md for background.'
        result = self._sanitize(text)
        assert 'Project_Context.md' not in result

    def test_collapses_extra_whitespace(self):
        text = 'Word   with   extra   spaces.'
        result = self._sanitize(text)
        assert '   ' not in result

    def test_collapses_triple_newlines(self):
        text = 'Para one.\n\n\n\nPara two.'
        result = self._sanitize(text)
        assert '\n\n\n' not in result

    def test_strips_smq_answer_without_underscore(self):
        text = 'Per the SMQ Answer section, the following...'
        result = self._sanitize(text)
        assert 'SMQ Answer' not in result

    def test_preserves_surrounding_content(self):
        text = 'Start [Doc: file.pdf] end.'
        result = self._sanitize(text)
        assert 'Start' in result
        assert 'end.' in result


class TestGetExportStatus:
    """Tests for get_export_status — requires DB access."""

    @pytest.mark.django_db
    def test_returns_dict_with_required_keys(self):
        from ner.services.report_export import get_export_status
        from django.contrib.auth import get_user_model
        from ingestion.models import Project

        User = get_user_model()
        user = User.objects.create_user(username='export_test_u', password='pass')
        project = Project.objects.create(name='Export Test Project', owner=user)

        result = get_export_status(project)

        assert 'can_export' in result
        assert 'complete_sections' in result
        assert 'total_sections' in result
        assert 'has_stakeholder_table' in result
        assert 'has_personas' in result
        assert 'has_workplan' in result
        assert 'section_statuses' in result

    @pytest.mark.django_db
    def test_can_export_false_for_empty_project(self):
        from ner.services.report_export import get_export_status
        from django.contrib.auth import get_user_model
        from ingestion.models import Project

        User = get_user_model()
        user = User.objects.create_user(username='export_test_empty', password='pass')
        project = Project.objects.create(name='Empty Project', owner=user)

        result = get_export_status(project)

        assert result['can_export'] is False
        assert result['complete_sections'] == 0
        assert result['has_stakeholder_table'] is False
        assert result['has_personas'] is False
        assert result['has_workplan'] is False
