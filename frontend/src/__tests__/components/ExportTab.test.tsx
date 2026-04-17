/**
 * Integration tests for src/components/ExportTab.tsx
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ExportTab from '@/components/ExportTab';

jest.mock('@/lib/api', () => ({
  getReportExportStatus: jest.fn(),
  downloadReportPdf: jest.fn(),
  downloadReportDocx: jest.fn(),
  renderLLMErrorMessage: jest.fn((e: any, ctx: string) => `${ctx} failed`),
}));

import {
  getReportExportStatus,
  downloadReportPdf,
  downloadReportDocx,
} from '@/lib/api';

const mockGetExportStatus = getReportExportStatus as jest.Mock;
const mockDownloadPdf = downloadReportPdf as jest.Mock;
const mockDownloadDocx = downloadReportDocx as jest.Mock;

const readyExportStatus = {
  can_export: true,
  complete_sections: 3,
  total_sections: 4,
  has_stakeholder_table: true,
  has_personas: true,
  has_workplan: false,
  section_statuses: [
    { section_number: 1, title: 'Context', status: 'done' },
    { section_number: 2, title: 'Analysis', status: 'done' },
    { section_number: 3, title: 'Recommendations', status: 'done' },
    { section_number: 4, title: 'Engagement', status: 'pending' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDownloadPdf.mockResolvedValue(undefined);
  mockDownloadDocx.mockResolvedValue(undefined);
});

describe('ExportTab — loading state', () => {
  test('shows loading spinner initially', () => {
    mockGetExportStatus.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ExportTab projectId="proj-1" />);
    expect(screen.getByText(/loading export status/i)).toBeInTheDocument();
  });
});

describe('ExportTab — error state', () => {
  test('shows error message when status fetch fails', async () => {
    mockGetExportStatus.mockRejectedValue(new Error('Network error'));
    render(<ExportTab projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Export status check failed/)).toBeInTheDocument();
    });
  });
});

describe('ExportTab — ready state', () => {
  beforeEach(() => {
    mockGetExportStatus.mockResolvedValue(readyExportStatus);
  });

  test('shows "Your report is ready to export" heading', async () => {
    render(<ExportTab projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByText(/your report is ready to export/i)).toBeInTheDocument();
    });
  });

  test('download PDF button is enabled when can_export=true', async () => {
    render(<ExportTab projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByText(/download pdf report/i).closest('button')).not.toBeDisabled();
    });
  });

  test('clicking PDF button calls downloadReportPdf', async () => {
    render(<ExportTab projectId="proj-1" />);
    await waitFor(() => screen.getByText(/download pdf report/i));
    fireEvent.click(screen.getByText(/download pdf report/i));
    expect(mockDownloadPdf).toHaveBeenCalledWith('proj-1');
  });

  test('clicking DOCX button calls downloadReportDocx', async () => {
    render(<ExportTab projectId="proj-1" />);
    await waitFor(() => screen.getByText(/download word document/i));
    fireEvent.click(screen.getByText(/download word document/i));
    expect(mockDownloadDocx).toHaveBeenCalledWith('proj-1');
  });

  test('renders section checklist', async () => {
    render(<ExportTab projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByText('Section 1: Context')).toBeInTheDocument();
      expect(screen.getByText('Section 4: Engagement')).toBeInTheDocument();
    });
  });

  test('stale section shows "(stale)" annotation', async () => {
    const statusWithStale = {
      ...readyExportStatus,
      section_statuses: [
        { section_number: 1, title: 'Context', status: 'stale' },
      ],
    };
    mockGetExportStatus.mockResolvedValue(statusWithStale);
    render(<ExportTab projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByText('(stale)')).toBeInTheDocument();
    });
  });
});

describe('ExportTab — not ready state', () => {
  test('download buttons are disabled when can_export=false', async () => {
    mockGetExportStatus.mockResolvedValue({ ...readyExportStatus, can_export: false });
    render(<ExportTab projectId="proj-1" />);
    await waitFor(() => screen.getByText(/download pdf report/i));
    expect(screen.getByText(/download pdf report/i).closest('button')).toBeDisabled();
    expect(screen.getByText(/download word document/i).closest('button')).toBeDisabled();
  });

  test('shows "Complete these steps" heading when not ready', async () => {
    mockGetExportStatus.mockResolvedValue({ ...readyExportStatus, can_export: false });
    render(<ExportTab projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByText(/complete these steps before exporting/i)).toBeInTheDocument();
    });
  });
});
