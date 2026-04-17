import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StakeholderPriorityTable from '@/components/StakeholderPriorityTable';

const mockPush = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api', () => ({
  getProjectStakeholderPriority: jest.fn(),
  generateProjectStakeholderNotes: jest.fn(),
  exportProjectStakeholderPriorityCsv: jest.fn(),
  exportProjectStakeholderPriorityPdf: jest.fn(),
  exportProjectStakeholderPriorityDocx: jest.fn(),
  flagProjectOrphanStakeholders: jest.fn(),
  renderLLMErrorMessage: jest.fn((e: any, ctx: string) => `${ctx}: ${String(e?.message || e)}`),
}));

import {
  getProjectStakeholderPriority,
  generateProjectStakeholderNotes,
  exportProjectStakeholderPriorityCsv,
  exportProjectStakeholderPriorityPdf,
  exportProjectStakeholderPriorityDocx,
  flagProjectOrphanStakeholders,
  renderLLMErrorMessage,
} from '@/lib/api';

const mockGetPriority = getProjectStakeholderPriority as jest.Mock;
const mockGenerateNotes = generateProjectStakeholderNotes as jest.Mock;
const mockExportCsv = exportProjectStakeholderPriorityCsv as jest.Mock;
const mockExportPdf = exportProjectStakeholderPriorityPdf as jest.Mock;
const mockExportDocx = exportProjectStakeholderPriorityDocx as jest.Mock;
const mockFlagOrphans = flagProjectOrphanStakeholders as jest.Mock;

const row = {
  rank: 1,
  entity_id: 'ent-1',
  name: 'UNDP',
  category: 'Public Sector',
  entity_type: 'ORGANIZATION',
  mention_count: 12,
  avg_confidence: 0.93,
  degree: 0,
  priority_score: 9.876,
  priority_level: 'high' as const,
  priority_reason: 'Key actor in implementation planning and financing.',
  recommended_ask: 'Co-sponsor implementation guidance and convene partners.',
  engagement_note: null,
};

describe('StakeholderPriorityTable', () => {
  let createElementSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    (global as any).URL.createObjectURL = jest.fn(() => 'blob:test-url');
    (global as any).URL.revokeObjectURL = jest.fn();

    const realCreateElement = document.createElement.bind(document);
    createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return {
          href: '',
          download: '',
          click: jest.fn(),
          remove: jest.fn(),
        } as any;
      }
      return realCreateElement(tagName);
    });

    mockGetPriority.mockResolvedValue({
      count: 1,
      page: 1,
      total_pages: 2,
      results: [row],
    });
    mockGenerateNotes.mockResolvedValue({
      status: 'completed',
      total_target: 1,
      completed_count: 1,
      current_index: 1,
      message: 'Engagement notes generated.',
    });
    mockExportCsv.mockResolvedValue(new Blob(['csv']));
    mockExportPdf.mockResolvedValue(new Blob(['pdf']));
    mockExportDocx.mockResolvedValue(new Blob(['docx']));
    mockFlagOrphans.mockResolvedValue({
      flagged_count: 1,
      detail: 'Flagged 1 isolated stakeholder(s).',
    });
  });

  afterEach(() => {
    createElementSpy?.mockRestore();
  });

  test('loads rows, renders isolated badge, and navigates to entity detail', async () => {
    render(<StakeholderPriorityTable projectId="proj-1" />);

    await waitFor(() => {
      expect(mockGetPriority).toHaveBeenCalledWith('proj-1', {
        entity_type: undefined,
        page: 1,
      });
      expect(screen.getByText('UNDP')).toBeInTheDocument();
    });

    expect(screen.getByText('Isolated')).toBeInTheDocument();
    expect(screen.getByText('93%')).toBeInTheDocument();
    expect(screen.getByText('9.88')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'UNDP' }));
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/entities/ent-1');
  });

  test('applies entity-type filter and paginates to next page', async () => {
    render(<StakeholderPriorityTable projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText('UNDP')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Filter stakeholders by entity type'), {
      target: { value: 'PERSON' },
    });

    await waitFor(() => {
      expect(mockGetPriority).toHaveBeenLastCalledWith('proj-1', {
        entity_type: 'PERSON',
        page: 1,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(mockGetPriority).toHaveBeenLastCalledWith('proj-1', {
        entity_type: 'PERSON',
        page: 2,
      });
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });
  });

  test('runs note generation from resume state and notifies parent callback', async () => {
    const onGenerationStateChange = jest.fn();

    render(
      <StakeholderPriorityTable
        projectId="proj-1"
        generationState={{
          status: 'paused_rate_limited',
          total_target: 5,
          completed_count: 2,
          current_index: 2,
          message: 'Paused due to provider limits',
        }}
        onGenerationStateChange={onGenerationStateChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resume generation' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Resume generation' }));

    await waitFor(() => {
      expect(mockGenerateNotes).toHaveBeenCalledWith('proj-1', { action: 'resume', max_items: 20 });
      expect(onGenerationStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', completed_count: 1 }),
      );
      expect(screen.getByText(/Engagement notes generated/i)).toBeInTheDocument();
    });
  });

  test('stops generation when running', async () => {
    render(
      <StakeholderPriorityTable
        projectId="proj-1"
        generationState={{
          status: 'running',
          total_target: 5,
          completed_count: 1,
          current_index: 1,
          message: 'Generating...',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop generation' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stop generation' }));

    await waitFor(() => {
      expect(mockGenerateNotes).toHaveBeenCalledWith('proj-1', { action: 'stop', max_items: 20 });
    });
  });

  test('downloads CSV/PDF/DOCX and flags isolated stakeholders', async () => {
    render(<StakeholderPriorityTable projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Download Top 20 CSV' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download Top 20 CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download Top 20 PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download Top 20 DOCX' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flag Isolated' }));

    await waitFor(() => {
      expect(mockExportCsv).toHaveBeenCalledWith('proj-1', undefined, 20);
      expect(mockExportPdf).toHaveBeenCalledWith('proj-1', undefined, 20);
      expect(mockExportDocx).toHaveBeenCalledWith('proj-1', undefined, 20);
      expect(mockFlagOrphans).toHaveBeenCalledWith('proj-1');
      expect(screen.getByText('Flagged 1 isolated stakeholder(s).')).toBeInTheDocument();
    });
  });

  test('shows error state when table load fails', async () => {
    mockGetPriority.mockRejectedValueOnce(new Error('network fail'));

    render(<StakeholderPriorityTable projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load stakeholder priority table/i)).toBeInTheDocument();
    });
  });

  test('uses LLM error renderer when generation request fails', async () => {
    mockGenerateNotes.mockRejectedValueOnce(new Error('provider down'));

    render(<StakeholderPriorityTable projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generate Engagement Notes' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate Engagement Notes' }));

    await waitFor(() => {
      expect(renderLLMErrorMessage).toHaveBeenCalled();
      expect(screen.getByText(/Engagement note generation: provider down/i)).toBeInTheDocument();
    });
  });
});
