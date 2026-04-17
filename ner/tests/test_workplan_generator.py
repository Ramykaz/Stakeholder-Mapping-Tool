"""Unit tests for ner.services.workplan_generator."""

import json
import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model

User = get_user_model()


class TestParseJsonResponse:
    def test_valid_json_with_components(self):
        from ner.services.workplan_generator import _parse_json_response
        result = _parse_json_response('{"components": [{"title": "Phase 1"}]}')
        assert result is not None
        assert len(result['components']) == 1

    def test_markdown_code_fence_stripped(self):
        from ner.services.workplan_generator import _parse_json_response
        text = '```json\n{"components": []}\n```'
        result = _parse_json_response(text)
        assert result == {'components': []}

    def test_leading_prose_before_json_stripped(self):
        from ner.services.workplan_generator import _parse_json_response
        text = 'Here is the plan: {"components": [{"title": "A"}]}'
        result = _parse_json_response(text)
        assert result is not None
        assert result.get('components') is not None

    def test_trailing_code_fence_stripped(self):
        from ner.services.workplan_generator import _parse_json_response
        text = '{"components": []} ```'
        result = _parse_json_response(text)
        assert result is not None

    def test_invalid_json_returns_none(self):
        from ner.services.workplan_generator import _parse_json_response
        assert _parse_json_response('not json') is None

    def test_empty_string_returns_none(self):
        from ner.services.workplan_generator import _parse_json_response
        assert _parse_json_response('') is None


class TestWorkplanGenerationError:
    def test_is_exception_subclass(self):
        from ner.services.workplan_generator import WorkplanGenerationError
        assert issubclass(WorkplanGenerationError, Exception)

    def test_can_be_raised_and_caught(self):
        from ner.services.workplan_generator import WorkplanGenerationError
        with pytest.raises(WorkplanGenerationError, match='missing'):
            raise WorkplanGenerationError('Component data missing')


class TestGenerateWorkplanJsonFunction:
    @patch('ner.services.workplan_generator._call_provider')
    def test_returns_parsed_data_on_success(self, mock_call):
        from ner.services.workplan_generator import _generate_workplan_json
        mock_call.return_value = json.dumps({
            'components': [
                {'title': 'Community Engagement', 'tasks': [
                    {'task_description': 'Hold meetings', 'suggested_owner': 'PM',
                     'timeline': 'Month 1', 'dependencies': '', 'kpis': '', 'related_stakeholder': ''}
                ]}
            ]
        })

        result = _generate_workplan_json('prompt text', provider='groq', model='llama3-8b-8192')
        assert result is not None
        assert 'components' in result
        assert result['components'][0]['title'] == 'Community Engagement'

    @patch('ner.services.workplan_generator._call_provider')
    def test_returns_none_when_no_components_key(self, mock_call):
        from ner.services.workplan_generator import _generate_workplan_json
        mock_call.return_value = '{"phases": [{"title": "Phase 1"}]}'
        result = _generate_workplan_json('prompt', provider='groq', model='llama3-8b-8192')
        assert result is None

    @patch('ner.services.workplan_generator._call_provider')
    def test_returns_none_when_components_not_list(self, mock_call):
        from ner.services.workplan_generator import _generate_workplan_json
        mock_call.return_value = '{"components": "not a list"}'
        result = _generate_workplan_json('prompt', provider='groq', model='llama3-8b-8192')
        assert result is None


class TestGenerateWorkplanForProject(TestCase):
    def setUp(self):
        from ingestion.models import Project
        self.user = User.objects.create_user('wp_gen_user', 'wpgen@example.com', 'Pass123')
        self.project = Project.objects.create(name='WP Gen Project', owner=self.user)

    @patch('ner.services.workplan_generator._generate_workplan_json')
    @patch('ner.services.workplan_generator.resolve_provider_model_for_project')
    @patch('ner.services.priority_table.compute_priority_scores')
    def test_success_creates_components_and_returns_count(
        self, mock_scores, mock_resolve, mock_gen
    ):
        from ner.services.workplan_generator import generate_workplan_for_project

        mock_scores.return_value = []
        mock_resolve.return_value = MagicMock(provider='groq', model='llama3-8b-8192')
        mock_gen.return_value = {
            'components': [
                {'title': 'Phase 1', 'tasks': [
                    {'task_description': 'Hold workshops', 'suggested_owner': 'PM',
                     'timeline': 'Q1', 'dependencies': '', 'kpis': '', 'related_stakeholder': ''}
                ]},
                {'title': 'Phase 2', 'tasks': []},
            ]
        }

        count = generate_workplan_for_project(str(self.project.id))
        assert count == 2

    @patch('ner.services.workplan_generator._generate_workplan_json')
    @patch('ner.services.workplan_generator.resolve_provider_model_for_project')
    @patch('ner.services.priority_table.compute_priority_scores')
    def test_raises_workplan_generation_error_when_no_data(
        self, mock_scores, mock_resolve, mock_gen
    ):
        from ner.services.workplan_generator import (
            generate_workplan_for_project, WorkplanGenerationError
        )
        mock_scores.return_value = []
        mock_resolve.return_value = MagicMock(provider='groq', model='llama3-8b-8192')
        mock_gen.return_value = None

        with pytest.raises(WorkplanGenerationError):
            generate_workplan_for_project(str(self.project.id))

    @patch('ner.services.workplan_generator._generate_workplan_json')
    @patch('ner.services.workplan_generator.resolve_provider_model_for_project')
    @patch('ner.services.priority_table.compute_priority_scores')
    def test_raises_when_components_empty_list(
        self, mock_scores, mock_resolve, mock_gen
    ):
        from ner.services.workplan_generator import (
            generate_workplan_for_project, WorkplanGenerationError
        )
        mock_scores.return_value = []
        mock_resolve.return_value = MagicMock(provider='groq', model='llama3-8b-8192')
        mock_gen.return_value = {'components': []}

        with pytest.raises(WorkplanGenerationError):
            generate_workplan_for_project(str(self.project.id))
