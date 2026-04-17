"""Unit tests for ner.services.persona_generator."""

import json
from unittest.mock import patch
from django.contrib.auth import get_user_model

User = get_user_model()


class TestParseJsonResponse:
    def test_valid_json_object(self):
        from ner.services.persona_generator import _parse_json_response
        result = _parse_json_response('{"key": "value"}')
        assert result == {'key': 'value'}

    def test_markdown_wrapped_json(self):
        from ner.services.persona_generator import _parse_json_response
        text = '```json\n{"persona_name": "Alice"}\n```'
        result = _parse_json_response(text)
        assert result['persona_name'] == 'Alice'

    def test_json_embedded_in_prose(self):
        from ner.services.persona_generator import _parse_json_response
        text = 'Here is the result: {"persona_name": "Bob"} — end'
        result = _parse_json_response(text)
        assert result is not None
        assert result.get('persona_name') == 'Bob'

    def test_invalid_json_returns_none(self):
        from ner.services.persona_generator import _parse_json_response
        assert _parse_json_response('not json at all') is None

    def test_empty_string_returns_none(self):
        from ner.services.persona_generator import _parse_json_response
        assert _parse_json_response('') is None

    def test_list_json_returns_none_or_non_dict(self):
        from ner.services.persona_generator import _parse_json_response
        # A bare list JSON — parser may return None, the list, or a dict; it should not crash
        result = _parse_json_response('[{"a": 1}]')
        assert result is None or isinstance(result, (dict, list))


class TestGenerateSinglePersona:
    @patch('ner.services.persona_generator._call_provider')
    def test_returns_dict_with_required_fields(self, mock_call):
        from ner.services.persona_generator import _generate_single_persona

        mock_call.return_value = json.dumps({
            'persona_name': 'Community Leader',
            'archetype_label': 'Advocate',
            'demographics': '35-55 years, rural',
            'motivations': ['Improve water access', 'Empower community', 'Reduce inequality'],
            'frustrations': ['Lack of funding', 'Bureaucracy', 'Poor coordination'],
        })

        result = _generate_single_persona(
            entity_type_name='PERSON',
            entity_names=['Alice', 'Bob'],
            descriptions=[],
            project_context='Climate adaptation project',
            provider='groq',
            model='llama3-8b-8192',
        )

        assert result is not None
        assert result['persona_name'] == 'Community Leader'
        assert len(result['motivations']) == 3
        assert len(result['frustrations']) == 3

    @patch('ner.services.persona_generator._call_provider')
    def test_returns_none_when_json_invalid(self, mock_call):
        from ner.services.persona_generator import _generate_single_persona
        mock_call.return_value = 'Not valid JSON at all'

        result = _generate_single_persona(
            entity_type_name='ORG',
            entity_names=['UNDP'],
            descriptions=[],
            project_context='',
            provider='groq',
            model='llama3-8b-8192',
        )
        assert result is None

    @patch('ner.services.persona_generator._call_provider')
    def test_returns_none_when_required_fields_missing(self, mock_call):
        from ner.services.persona_generator import _generate_single_persona
        # Missing 'frustrations' field
        mock_call.return_value = json.dumps({
            'persona_name': 'Leader',
            'archetype_label': 'Advocate',
            'demographics': 'Mixed',
            'motivations': ['A', 'B', 'C'],
        })

        result = _generate_single_persona(
            entity_type_name='ORG',
            entity_names=['UNICEF'],
            descriptions=[],
            project_context='',
            provider='groq',
            model='llama3-8b-8192',
        )
        assert result is None

    @patch('ner.services.persona_generator._call_provider')
    def test_motivations_capped_at_3(self, mock_call):
        from ner.services.persona_generator import _generate_single_persona
        mock_call.return_value = json.dumps({
            'persona_name': 'Person',
            'archetype_label': 'Type',
            'demographics': 'General',
            'motivations': ['A', 'B', 'C', 'D', 'E'],  # 5 items
            'frustrations': ['X', 'Y', 'Z'],
        })

        result = _generate_single_persona(
            entity_type_name='PERSON',
            entity_names=['Alice'],
            descriptions=[],
            project_context='',
            provider='groq',
            model='llama3-8b-8192',
        )
        assert len(result['motivations']) == 3

    @patch('ner.services.persona_generator._call_provider')
    def test_exception_returns_none(self, mock_call):
        from ner.services.persona_generator import _generate_single_persona
        mock_call.side_effect = RuntimeError('LLM unavailable')

        result = _generate_single_persona(
            entity_type_name='PERSON',
            entity_names=['Bob'],
            descriptions=[],
            project_context='',
            provider='groq',
            model='llama3-8b-8192',
        )
        assert result is None
