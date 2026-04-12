import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ReportSectionCard from '@/components/ReportSectionCard';
import { ReportSectionResponse } from '@/lib/api';

function makeSection(overrides: Partial<ReportSectionResponse> = {}): ReportSectionResponse {
  return {
    section_id: 'sec-1',
    section_number: 1,
    section_title: 'Executive Summary',
    status: 'pending',
    generated_text: '',
    citations: [],
    error_message: '',
    generated_at: null,
    ...overrides,
  };
}

describe('ReportSectionCard', () => {
  it('shows pending state and keeps regenerate available', () => {
    const onRegenerate = jest.fn();
    render(
      <ReportSectionCard
        section={makeSection({ status: 'pending' })}
        onRegenerate={onRegenerate}
        onSaveEdit={() => {}}
      />,
    );

    expect(screen.getByText('Section not generated yet.')).toBeTruthy();
    fireEvent.click(screen.getByText('Regenerate'));
    expect(onRegenerate).toHaveBeenCalledWith('sec-1', '');
  });

  it('replaces initiative placeholders in done text', () => {
    render(
      <ReportSectionCard
        section={makeSection({ status: 'done', generated_text: '[The Initiative] builds trust.' })}
        initiativeName='UN Joint Program'
        onRegenerate={() => {}}
        onSaveEdit={() => {}}
      />,
    );

    expect(screen.getByText('UN Joint Program builds trust.')).toBeTruthy();
  });

  it('normalizes markdown artifacts in done text rendering', () => {
    render(
      <ReportSectionCard
        section={makeSection({ status: 'done', generated_text: '# Heading\n\n- **Insight** with *artifact*' })}
        onRegenerate={() => {}}
        onSaveEdit={() => {}}
      />,
    );

    expect(screen.getByText('Heading')).toBeTruthy();
    expect(screen.getByText('Insight with artifact')).toBeTruthy();
  });

  it('passes refinement instruction when regenerating', () => {
    const onRegenerate = jest.fn();

    render(
      <ReportSectionCard
        section={makeSection({ status: 'error', error_message: 'Generation timed out.' })}
        onRegenerate={onRegenerate}
        onSaveEdit={() => {}}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. focus more on government stakeholders'), {
      target: { value: 'Focus on oversight and accountability' },
    });
    fireEvent.click(screen.getByText('Regenerate'));

    expect(onRegenerate).toHaveBeenCalledWith('sec-1', 'Focus on oversight and accountability');
  });
});
