from stakeholder_analysis.celery import app


def test_celery_app_is_initialized():
    assert app is not None
    assert app.main == 'stakeholder_analysis'


def test_celery_app_includes_project_task_modules():
    include = set(getattr(app, 'include', ()) or ())
    assert 'ingestion.tasks' in include
    assert 'ner.tasks' in include
