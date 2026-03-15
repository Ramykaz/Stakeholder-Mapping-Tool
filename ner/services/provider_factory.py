"""Provider abstraction and factory resolution for NER extraction clients."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ner.services.groq_client import extract_entities_from_chunk as extract_groq_entities_from_chunk
from ner.services.openai_client import extract_entities_from_chunk as extract_openai_entities_from_chunk


@dataclass(frozen=True)
class ProviderConfig:
    """Provider and model selection for a single NER extraction run."""

    provider: str
    model: str


class LLMProvider(Protocol):
    """Interface for provider-specific extraction clients."""

    def extract_entities(self, text_chunk: str) -> dict:
        """Return an object with at least an `entities` list."""


@dataclass
class GroqProvider:
    api_key: str
    model: str

    def extract_entities(self, text_chunk: str) -> dict:
        return extract_groq_entities_from_chunk(text_chunk, self.api_key, model=self.model)


@dataclass
class OpenAIProvider:
    api_key: str
    model: str

    def extract_entities(self, text_chunk: str) -> dict:
        return extract_openai_entities_from_chunk(text_chunk, self.api_key, model=self.model)


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
        raise RuntimeError(f"{provider.upper()}_API_KEY environment variable not set")
    if provider == 'groq':
        return GroqProvider(api_key=key, model=config.model)
    if provider == 'openai':
        return OpenAIProvider(api_key=key, model=config.model)
    raise ValueError(f"Unsupported provider: {provider}")
