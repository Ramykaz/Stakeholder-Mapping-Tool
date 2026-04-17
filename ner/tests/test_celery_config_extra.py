from stakeholder_analysis.celery import app


def test_celery_app_contract_and_includes():
    assert app is not None
    assert app.main == 'stakeholder_analysis'
    assert callable(app.autodiscover_tasks)
    assert app.conf is not None
