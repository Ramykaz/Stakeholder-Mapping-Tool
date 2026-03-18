"""Factory helpers for NER API integration tests."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from ingestion.models import Document, Project
from ner.models import Entity, NERRun, Relation


User = get_user_model()


def create_user_with_token(username: str = 'tester'):
    user = User.objects.create_user(
        username=username,
        email=f'{username}@example.com',
        password='Password123',
    )
    token = Token.objects.create(user=user)
    return user, token


def create_project_with_document(owner, filename='fixture.txt'):
    project = Project.objects.create(name='Fixture Project', owner=owner)
    document = Document.objects.create(
        filename=filename,
        file_format='txt',
        processing_status='completed',
        project=project,
    )
    return project, document


def create_run_for_document(document, provider='groq', model='llama-3.1-8b-instant'):
    return NERRun.objects.create(
        document_id=document,
        provider=provider,
        model=model,
        status=NERRun.STATUS_COMPLETED,
        tokens_input=0,
        tokens_output=0,
        tokens_cached=0,
        cost_usd='0.000000',
    )


def create_entity(document, run, project, name='UNDP', entity_type='ORGANIZATION', confidence=0.9):
    return Entity.objects.create(
        entity_type=entity_type,
        canonical_name=name,
        raw_mentions=[name],
        confidence=confidence,
        document_id=document,
        run=run,
        project=project,
    )


def create_relation(document, run, project, source, target, label='PARTNERS_WITH', confidence=0.8):
    return Relation.objects.create(
        document_id=document,
        run=run,
        project=project,
        source_entity=source,
        target_entity=target,
        label=label,
        confidence=confidence,
    )
