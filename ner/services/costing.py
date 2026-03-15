"""Cost calculation helpers for NER provider usage metrics."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


OPENAI_PRICING_PER_MILLION = {
    'gpt-4o-mini': {
        'input': Decimal('0.15'),
        'cached_input': Decimal('0.075'),
        'output': Decimal('0.60'),
    },
    'gpt-5-mini': {
        'input': Decimal('0.25'),
        'cached_input': Decimal('0.025'),
        'output': Decimal('2.00'),
    },
    'gpt-5-nano': {
        'input': Decimal('0.05'),
        'cached_input': Decimal('0.005'),
        'output': Decimal('0.40'),
    },
}


def calculate_openai_cost_usd(model: str, input_tokens: int, output_tokens: int, cached_tokens: int) -> Decimal:
    """Calculate OpenAI request cost in USD from token usage and model rates."""
    rates = OPENAI_PRICING_PER_MILLION.get(model)
    if not rates:
        return Decimal('0.000000')

    input_tokens = max(int(input_tokens or 0), 0)
    output_tokens = max(int(output_tokens or 0), 0)
    cached_tokens = max(int(cached_tokens or 0), 0)

    non_cached_input_tokens = max(input_tokens - cached_tokens, 0)

    input_cost = (Decimal(non_cached_input_tokens) / Decimal(1_000_000)) * rates['input']
    cached_input_cost = (Decimal(cached_tokens) / Decimal(1_000_000)) * rates['cached_input']
    output_cost = (Decimal(output_tokens) / Decimal(1_000_000)) * rates['output']

    total = input_cost + cached_input_cost + output_cost
    return total.quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
