import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EntitySidePanel from '@/components/EntitySidePanel';

const BASE_NODE: any = {
  id: 'n1',
  label: 'UNDP',
  data: {
    entity_id: 'n1',
    entity_type: 'ORGANIZATION',
    confidence: 0.92,
    document_id: 'doc-1',
    chunk_id: null,
    raw_mentions_count: 3,
  },
};

describe('Entity summary UI states', () => {
  it('renders idle state and triggers generate/refresh actions', () => {
    const onGenerateSummary = jest.fn();

    render(
      <EntitySidePanel
        node={BASE_NODE}
        profile={{ id: 'n1', canonical_name: 'UNDP', entity_type: 'ORGANIZATION', projects: [] }}
        loadingProfile={false}
        summary={null}
        loadingSummary={false}
        summaryEnabled={true}
        onClose={() => {}}
        onSelectRelated={() => {}}
        onGenerateSummary={onGenerateSummary}
      />,
    );

    expect(screen.getByText('No summary yet.')).toBeTruthy();
    fireEvent.click(screen.getByText('Generate'));
    fireEvent.click(screen.getByText('Refresh'));
    expect(onGenerateSummary).toHaveBeenCalledWith(false);
    expect(onGenerateSummary).toHaveBeenCalledWith(true);
  });

  it('renders loading and ready states', () => {
    const { rerender } = render(
      <EntitySidePanel
        node={BASE_NODE}
        profile={{ id: 'n1', canonical_name: 'UNDP', entity_type: 'ORGANIZATION', projects: [] }}
        loadingProfile={false}
        summary={null}
        loadingSummary={true}
        summaryEnabled={true}
        onClose={() => {}}
        onSelectRelated={() => {}}
        onGenerateSummary={() => {}}
      />,
    );

    expect(screen.getByText('…')).toBeTruthy();

    rerender(
      <EntitySidePanel
        node={BASE_NODE}
        profile={{ id: 'n1', canonical_name: 'UNDP', entity_type: 'ORGANIZATION', projects: [] }}
        loadingProfile={false}
        summary={{ entity_id: 'n1', project_id: 'p1', summary: 'Context paragraph', source: 'provider' }}
        loadingSummary={false}
        summaryEnabled={true}
        onClose={() => {}}
        onSelectRelated={() => {}}
        onGenerateSummary={() => {}}
      />,
    );

    expect(screen.getByText('Context paragraph')).toBeTruthy();
  });

  it('renders fallback state with retry path available', () => {
    render(
      <EntitySidePanel
        node={BASE_NODE}
        profile={{ id: 'n1', canonical_name: 'UNDP', entity_type: 'ORGANIZATION', projects: [] }}
        loadingProfile={false}
        summary={{
          entity_id: 'n1',
          project_id: 'p1',
          summary: null,
          fallback_message: 'Summary unavailable right now. Try again.',
          retryable: true,
        }}
        loadingSummary={false}
        summaryEnabled={true}
        onClose={() => {}}
        onSelectRelated={() => {}}
        onGenerateSummary={() => {}}
      />,
    );

    expect(screen.getByText('Summary unavailable right now. Try again.')).toBeTruthy();
    expect(screen.getByText('Generate')).toBeTruthy();
  });
});
