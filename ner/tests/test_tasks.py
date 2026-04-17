"""Unit/integration tests for ner.tasks (Celery task wrappers)."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase

from ingestion.models import Project

User = get_user_model()


class TestGeneratePersonasTask(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('ner_tasks_user', 'nertasks@example.com', 'Pass123')
        self.project = Project.objects.create(name='NER Tasks Project', owner=self.user)
        self.project_id = str(self.project.id)
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch('ner.services.persona_generator.generate_personas_for_project')
    def test_success_sets_cache_completed_and_returns_count(self, mock_gen):
        mock_gen.return_value = 3

        from ner.tasks import generate_personas_task, _persona_generation_cache_key
        result = generate_personas_task.run(self.project_id)

        assert result['project_id'] == self.project_id
        assert result['personas_created'] == 3
        assert 'error' not in result

        status = cache.get(_persona_generation_cache_key(self.project_id))
        assert status['status'] == 'completed'

    @patch('ner.services.persona_generator.generate_personas_for_project')
    def test_zero_personas_sets_cache_error(self, mock_gen):
        mock_gen.return_value = 0

        from ner.tasks import generate_personas_task, _persona_generation_cache_key
        result = generate_personas_task.run(self.project_id)

        assert result['personas_created'] == 0
        assert result['error'] == 'no_personas_generated'

        status = cache.get(_persona_generation_cache_key(self.project_id))
        assert status['status'] == 'error'

    @patch('ner.services.persona_generator.generate_personas_for_project')
    def test_exception_sets_cache_error_and_returns_error_key(self, mock_gen):
        mock_gen.side_effect = RuntimeError('LLM unavailable')

        from ner.tasks import generate_personas_task, _persona_generation_cache_key
        result = generate_personas_task.run(self.project_id)

        assert 'error' in result
        assert 'LLM unavailable' in result['error']

        status = cache.get(_persona_generation_cache_key(self.project_id))
        assert status['status'] == 'error'

    @patch('ner.services.persona_generator.generate_personas_for_project')
    def test_cache_starts_running_then_transitions(self, mock_gen):
        """Cache key is set to 'running' before service is called."""
        call_order = []

        from ner.tasks import _persona_generation_cache_key

        def capture_status(*args, **kwargs):
            key = _persona_generation_cache_key(self.project_id)
            status = cache.get(key)
            call_order.append(status['status'] if status else None)
            return 2

        mock_gen.side_effect = capture_status

        from ner.tasks import generate_personas_task
        generate_personas_task.run(self.project_id)

        # When the service was called, the cache status was 'running'
        assert 'running' in call_order


class TestGenerateWorkplanTask(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('workplan_tasks_user', 'wptasks@example.com', 'Pass123')
        self.project = Project.objects.create(name='Workplan Tasks Project', owner=self.user)
        self.project_id = str(self.project.id)
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch('ner.services.workplan_generator.generate_workplan_for_project')
    def test_success_returns_components_count(self, mock_gen):
        mock_gen.return_value = 5

        from ner.tasks import generate_workplan_task, _workplan_generation_cache_key
        result = generate_workplan_task.run(self.project_id)

        assert result['project_id'] == self.project_id
        assert result['components_created'] == 5
        assert 'error' not in result

        status = cache.get(_workplan_generation_cache_key(self.project_id))
        assert status['status'] == 'completed'

    @patch('ner.services.workplan_generator.generate_workplan_for_project')
    def test_workplan_generation_error_sets_cache_error(self, mock_gen):
        from ner.services.workplan_generator import WorkplanGenerationError
        mock_gen.side_effect = WorkplanGenerationError('No phases found')

        from ner.tasks import generate_workplan_task, _workplan_generation_cache_key
        result = generate_workplan_task.run(self.project_id)

        assert 'error' in result
        assert 'No phases found' in result['error']

        status = cache.get(_workplan_generation_cache_key(self.project_id))
        assert status['status'] == 'error'

    @patch('ner.services.workplan_generator.generate_workplan_for_project')
    def test_generic_exception_sets_cache_error(self, mock_gen):
        mock_gen.side_effect = Exception('Unexpected crash')

        from ner.tasks import generate_workplan_task, _workplan_generation_cache_key
        result = generate_workplan_task.run(self.project_id)

        assert 'error' in result
        assert 'Unexpected crash' in result['error']

        status = cache.get(_workplan_generation_cache_key(self.project_id))
        assert status['status'] == 'error'


class TestGenerateReportSectionsTask(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('report_tasks_user', 'rptasks@example.com', 'Pass123')
        self.project = Project.objects.create(name='Report Tasks Project', owner=self.user)
        self.project_id = str(self.project.id)

    @patch('ner.tasks.generate_all_sections')
    def test_returns_project_id_and_sections_queued(self, mock_gen):
        mock_gen.return_value = None
        section_ids = ['sec-1', 'sec-2', 'sec-3']

        from ner.tasks import generate_report_sections_task
        result = generate_report_sections_task.run(self.project_id, section_ids)

        assert result['project_id'] == self.project_id
        assert result['sections_queued'] == 3
        mock_gen.assert_called_once()

    @patch('ner.tasks.generate_all_sections')
    def test_passes_custom_instruction(self, mock_gen):
        mock_gen.return_value = None

        from ner.tasks import generate_report_sections_task
        generate_report_sections_task.run(self.project_id, ['sec-1'], custom_instruction='Focus on risks.')

        _, kwargs = mock_gen.call_args
        assert kwargs.get('custom_instruction') == 'Focus on risks.'


class TestRegenerateReportSectionTask(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('regen_tasks_user', 'rgntasks@example.com', 'Pass123')
        self.project = Project.objects.create(name='Regen Tasks Project', owner=self.user)
        self.project_id = str(self.project.id)

    @patch('ner.tasks.generate_report_section')
    def test_returns_project_id_and_section_id(self, mock_gen):
        mock_gen.return_value = None

        from ner.tasks import regenerate_report_section_task
        result = regenerate_report_section_task.run(self.project_id, 'sec-1')

        assert result['project_id'] == self.project_id
        assert result['section_id'] == 'sec-1'

    @patch('ner.tasks.generate_report_section')
    def test_passes_custom_instruction(self, mock_gen):
        mock_gen.return_value = None

        from ner.tasks import regenerate_report_section_task
        regenerate_report_section_task.run(self.project_id, 'sec-1', custom_instruction='Be concise.')

        mock_gen.assert_called_once_with(
            self.project_id, 'sec-1', custom_instruction='Be concise.'
        )


class TestGeneratePriorityNotesTask(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('notes_tasks_user', 'notestasks@example.com', 'Pass123')
        self.project = Project.objects.create(name='Notes Tasks Project', owner=self.user)
        self.project_id = str(self.project.id)

    @patch('ner.tasks.generate_notes_for_project')
    def test_returns_project_id_and_generated_count(self, mock_gen):
        mock_gen.return_value = 4

        from ner.tasks import generate_priority_notes_task
        result = generate_priority_notes_task.run(self.project_id)

        assert result['project_id'] == self.project_id
        assert result['generated'] == 4
        mock_gen.assert_called_once_with(self.project_id)


class TestCacheHelpers(TestCase):
    """Unit tests for the module-level cache key and status helpers."""

    def tearDown(self):
        cache.clear()

    def test_persona_cache_key_format(self):
        from ner.tasks import _persona_generation_cache_key
        key = _persona_generation_cache_key('abc-123')
        assert key == 'persona_generation_status:abc-123'

    def test_workplan_cache_key_format(self):
        from ner.tasks import _workplan_generation_cache_key
        key = _workplan_generation_cache_key('abc-123')
        assert key == 'workplan_generation_status:abc-123'

    def test_set_generation_status_stores_dict(self):
        from ner.tasks import _set_generation_status
        _set_generation_status('test_key', 'running', 'In progress.')

        value = cache.get('test_key')
        assert value == {'status': 'running', 'message': 'In progress.'}

    def test_set_generation_status_empty_message(self):
        from ner.tasks import _set_generation_status
        _set_generation_status('test_key_2', 'completed')

        value = cache.get('test_key_2')
        assert value['status'] == 'completed'
        assert value['message'] == ''
