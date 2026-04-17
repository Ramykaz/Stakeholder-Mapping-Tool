/**
 * Unit tests for src/components/StalenessNotice.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StalenessNotice from '@/components/StalenessNotice';

describe('StalenessNotice', () => {
  const onRegenerate = jest.fn();
  const onKeepCurrent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders default title when none provided', () => {
    render(<StalenessNotice onRegenerate={onRegenerate} onKeepCurrent={onKeepCurrent} />);
    expect(screen.getByText(/new data available/i)).toBeInTheDocument();
  });

  test('renders custom title when provided', () => {
    render(
      <StalenessNotice
        title="Custom alert text"
        onRegenerate={onRegenerate}
        onKeepCurrent={onKeepCurrent}
      />,
    );
    expect(screen.getByText('Custom alert text')).toBeInTheDocument();
  });

  test('stale variant shows "Regenerate this section" as primary label', () => {
    render(
      <StalenessNotice variant="stale" onRegenerate={onRegenerate} onKeepCurrent={onKeepCurrent} />,
    );
    expect(screen.getByText('Regenerate this section')).toBeInTheDocument();
  });

  test('stale variant shows "Keep current version" as secondary label', () => {
    render(
      <StalenessNotice variant="stale" onRegenerate={onRegenerate} onKeepCurrent={onKeepCurrent} />,
    );
    expect(screen.getByText('Keep current version')).toBeInTheDocument();
  });

  test('rate_limit variant shows "Retry now" as primary label', () => {
    render(
      <StalenessNotice
        variant="rate_limit"
        onRegenerate={onRegenerate}
        onKeepCurrent={onKeepCurrent}
      />,
    );
    expect(screen.getByText('Retry now')).toBeInTheDocument();
  });

  test('rate_limit variant shows "Open settings" as secondary label', () => {
    render(
      <StalenessNotice
        variant="rate_limit"
        onRegenerate={onRegenerate}
        onKeepCurrent={onKeepCurrent}
      />,
    );
    expect(screen.getByText('Open settings')).toBeInTheDocument();
  });

  test('custom primaryLabel overrides variant default', () => {
    render(
      <StalenessNotice
        variant="stale"
        primaryLabel="Refresh now"
        onRegenerate={onRegenerate}
        onKeepCurrent={onKeepCurrent}
      />,
    );
    expect(screen.getByText('Refresh now')).toBeInTheDocument();
  });

  test('clicking primary button calls onRegenerate', () => {
    render(<StalenessNotice onRegenerate={onRegenerate} onKeepCurrent={onKeepCurrent} />);
    fireEvent.click(screen.getByText('Regenerate this section'));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  test('clicking secondary button calls onKeepCurrent', () => {
    render(<StalenessNotice onRegenerate={onRegenerate} onKeepCurrent={onKeepCurrent} />);
    fireEvent.click(screen.getByText('Keep current version'));
    expect(onKeepCurrent).toHaveBeenCalledTimes(1);
  });

  test('isRegenerating=true disables both buttons', () => {
    render(
      <StalenessNotice
        onRegenerate={onRegenerate}
        onKeepCurrent={onKeepCurrent}
        isRegenerating={true}
      />,
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  test('isRegenerating=true shows "Working…" on primary button', () => {
    render(
      <StalenessNotice
        onRegenerate={onRegenerate}
        onKeepCurrent={onKeepCurrent}
        isRegenerating={true}
      />,
    );
    expect(screen.getByText('Working…')).toBeInTheDocument();
  });
});
