"""Unit tests for OpenAI token cost calculation."""

from decimal import Decimal

from ner.services.costing import calculate_openai_cost_usd


def test_calculate_openai_cost_gpt_5_mini():
    """gpt-5-mini should use configured input/cached/output rates."""
    # 2,000 input tokens where 500 are cached, plus 1,000 output tokens.
    # Cost = (1500 * 0.25 + 500 * 0.025 + 1000 * 2.00) / 1_000_000
    result = calculate_openai_cost_usd(
        model='gpt-5-mini',
        input_tokens=2000,
        output_tokens=1000,
        cached_tokens=500,
    )

    assert result == Decimal('0.002388')


def test_calculate_openai_cost_gpt_5_nano():
    """gpt-5-nano should use configured lower pricing."""
    # 3,000 input tokens where 1,000 are cached, plus 500 output tokens.
    # Cost = (2000 * 0.05 + 1000 * 0.005 + 500 * 0.40) / 1_000_000
    result = calculate_openai_cost_usd(
        model='gpt-5-nano',
        input_tokens=3000,
        output_tokens=500,
        cached_tokens=1000,
    )

    assert result == Decimal('0.000305')
