"""Unit tests for ner.services.nl_query pure helper functions."""

import pytest


class TestIsNlQuestion:
    def test_question_word_first_token(self):
        from ner.services.nl_query import is_nl_question
        assert is_nl_question('Who is responsible for this project?')

    def test_what_question(self):
        from ner.services.nl_query import is_nl_question
        assert is_nl_question('What are the main risks?')

    def test_how_question(self):
        from ner.services.nl_query import is_nl_question
        assert is_nl_question('How does the governance work?')

    def test_long_phrase_detected(self):
        from ner.services.nl_query import is_nl_question
        # > 3 tokens, even without a question word
        assert is_nl_question('stakeholders in education sector')

    def test_single_keyword_not_question(self):
        from ner.services.nl_query import is_nl_question
        assert not is_nl_question('UNDP')

    def test_two_token_noun_phrase_not_question(self):
        from ner.services.nl_query import is_nl_question
        assert not is_nl_question('ministry education')

    def test_is_question_word(self):
        from ner.services.nl_query import is_nl_question
        assert is_nl_question('Is this project active?')

    def test_question_mark_on_first_token(self):
        from ner.services.nl_query import is_nl_question
        # "Who?" → stripped to "who"
        assert is_nl_question('Who?')

    def test_empty_string_not_question(self):
        from ner.services.nl_query import is_nl_question
        assert not is_nl_question('')


class TestNormalizeMessageContent:
    def test_none_returns_empty(self):
        from ner.services.nl_query import _normalize_message_content
        assert _normalize_message_content(None) == ''

    def test_string_passthrough(self):
        from ner.services.nl_query import _normalize_message_content
        assert _normalize_message_content('hello') == 'hello'

    def test_dict_with_text_key(self):
        from ner.services.nl_query import _normalize_message_content
        assert _normalize_message_content({'text': 'answer text'}) == 'answer text'

    def test_dict_with_content_key(self):
        from ner.services.nl_query import _normalize_message_content
        assert _normalize_message_content({'content': 'nested content'}) == 'nested content'

    def test_dict_with_no_known_key_returns_str(self):
        from ner.services.nl_query import _normalize_message_content
        result = _normalize_message_content({'unknown': 'value'})
        assert isinstance(result, str)

    def test_list_joins_parts(self):
        from ner.services.nl_query import _normalize_message_content
        result = _normalize_message_content(['part one', 'part two'])
        assert 'part one' in result
        assert 'part two' in result

    def test_nested_dict_in_list(self):
        from ner.services.nl_query import _normalize_message_content
        result = _normalize_message_content([{'text': 'nested'}])
        assert 'nested' in result

    def test_object_with_text_attr(self):
        from ner.services.nl_query import _normalize_message_content
        obj = type('Obj', (), {'text': 'attribute text'})()
        assert _normalize_message_content(obj) == 'attribute text'


class TestLoadPromptTemplate:
    def test_returns_default_when_file_missing(self, tmp_path, monkeypatch):
        from ner.services import nl_query
        # Point _PROMPT_PATH to a non-existent file
        monkeypatch.setattr(nl_query, '_PROMPT_PATH', tmp_path / 'nonexistent.txt')
        result = nl_query._load_prompt_template()
        assert '{question}' in result
        assert '{chunks}' in result

    def test_returns_file_content_when_exists(self, tmp_path, monkeypatch):
        from ner.services import nl_query
        prompt_file = tmp_path / 'nl_query_rag.txt'
        prompt_file.write_text('Custom template {question} {chunks} {project_name}', encoding='utf-8')
        monkeypatch.setattr(nl_query, '_PROMPT_PATH', prompt_file)
        result = nl_query._load_prompt_template()
        assert result == 'Custom template {question} {chunks} {project_name}'
