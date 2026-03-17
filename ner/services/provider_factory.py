"""Provider abstraction and factory resolution for NER extraction clients."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ner.services.azure_openai_client import extract_joint_from_chunk as extract_azure_joint_from_chunk
from ner.services.gemini_client import extract_joint_from_chunk as extract_gemini_joint_from_chunk
from ner.services.groq_client import extract_entities_from_chunk as extract_groq_entities_from_chunk
from ner.services.openai_client import extract_entities_from_chunk as extract_openai_entities_from_chunk
from ner.services.provider_interface import JointExtractionRequest
from ner.services.provider_runtime import ProviderConfigError, run_with_retry


@dataclass(frozen=True)
class ProviderConfig:
    """Provider and model selection for a single NER extraction run."""

    provider: str
    model: str


class LLMProvider(Protocol):
    """Interface for provider-specific extraction clients."""

    def extract_entities(self, text_chunk: str) -> dict:
        """Return an object with at least an `entities` list."""

    def extract_joint(self, payload: JointExtractionRequest) -> dict:
        """Return one response containing both entities and relationships."""


@dataclass
class GroqProvider:
    api_key: str
    model: str

    def extract_entities(self, text_chunk: str) -> dict:
        return run_with_retry(
            'groq',
            lambda: extract_groq_entities_from_chunk(text_chunk, self.api_key, model=self.model),
        )

    def extract_joint(self, payload: JointExtractionRequest) -> dict:
        return run_with_retry(
            'groq',
            lambda: extract_groq_entities_from_chunk(
                payload.chunk_text,
                self.api_key,
                model=payload.model,
                concept_note=payload.concept_note,
                entity_labels=payload.entity_labels,
                relationship_types=[
                    {'name': rel.name, 'directional': rel.directional} for rel in payload.relationship_types
                ],
            ),
        )


@dataclass
class OpenAIProvider:
    api_key: str
    model: str

    def extract_entities(self, text_chunk: str) -> dict:
        return run_with_retry(
            'openai',
            lambda: extract_openai_entities_from_chunk(text_chunk, self.api_key, model=self.model),
        )

    def extract_joint(self, payload: JointExtractionRequest) -> dict:
        return run_with_retry(
            'openai',
            lambda: extract_openai_entities_from_chunk(
                payload.chunk_text,
                self.api_key,
                model=payload.model,
                concept_note=payload.concept_note,
                entity_labels=payload.entity_labels,
                relationship_types=[
                    {'name': rel.name, 'directional': rel.directional} for rel in payload.relationship_types
                ],
            ),
        )


@dataclass
class AzureOpenAIProvider:
    api_key: str
    endpoint: str
    deployment: str
    model: str

    def extract_entities(self, text_chunk: str) -> dict:
        return self.extract_joint(
            JointExtractionRequest(
                chunk_text=text_chunk,
                concept_note=None,
                entity_labels=[],
                relationship_types=[],
                model=self.model,
            )
        )

    def extract_joint(self, payload: JointExtractionRequest) -> dict:
        return run_with_retry(
            'azure_openai',
            lambda: extract_azure_joint_from_chunk(
                payload.chunk_text,
                api_key=self.api_key,
                endpoint=self.endpoint,
                deployment=self.deployment,
                model=payload.model,
                concept_note=payload.concept_note,
                entity_labels=payload.entity_labels,
                relationship_types=[
                    {'name': rel.name, 'directional': rel.directional} for rel in payload.relationship_types
                ],
            ),
        )


@dataclass
class GeminiProvider:
    api_key: str
    model: str

    def extract_entities(self, text_chunk: str) -> dict:
        return self.extract_joint(
            JointExtractionRequest(
                chunk_text=text_chunk,
                concept_note=None,
                entity_labels=[],
                relationship_types=[],
                model=self.model,
            )
        )

    def extract_joint(self, payload: JointExtractionRequest) -> dict:
        return run_with_retry(
            'gemini',
            lambda: extract_gemini_joint_from_chunk(
                payload.chunk_text,
                api_key=self.api_key,
                model=payload.model,
                concept_note=payload.concept_note,
                entity_labels=payload.entity_labels,
                relationship_types=[
                    {'name': rel.name, 'directional': rel.directional} for rel in payload.relationship_types
                ],
            ),
        )


def validate_provider_config(config: ProviderConfig, allowlist: dict[str, list[str]]) -> None:
    """Raise ValueError when provider/model is not allowed by settings allowlist."""
    provider = (config.provider or '').strip().lower()
    model = (config.model or '').strip()
    if provider not in allowlist:
        raise ValueError(f"Unsupported provider: {provider}")
    if model not in allowlist[provider]:
        raise ValueError(f"Unsupported model '{model}' for provider '{provider}'")


def get_provider(config: ProviderConfig, api_keys: dict[str, str]) -> LLMProvider:
    """Instantiate a concrete provider implementation for the given config."""
    provider = config.provider.strip().lower()
    key = (api_keys.get(provider) or '').strip()
    if not key:
        raise ProviderConfigError(
            provider=provider,
            detail=f"{provider.upper()}_API_KEY environment variable not set",
        )
    if provider == 'groq':
        return GroqProvider(api_key=key, model=config.model)
    if provider == 'openai':
        return OpenAIProvider(api_key=key, model=config.model)
    if provider == 'azure_openai':
        from django.conf import settings

        endpoint = getattr(settings, 'AZURE_OPENAI_ENDPOINT', '').strip()
        deployment = getattr(settings, 'AZURE_OPENAI_DEPLOYMENT', '').strip()
        if not endpoint or not deployment:
            raise ProviderConfigError(
                provider=provider,
                detail='AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT must be configured',
            )
        return AzureOpenAIProvider(api_key=key, endpoint=endpoint, deployment=deployment, model=config.model)
    if provider == 'gemini':
        return GeminiProvider(api_key=key, model=config.model)
    raise ValueError(f"Unsupported provider: {provider}")
