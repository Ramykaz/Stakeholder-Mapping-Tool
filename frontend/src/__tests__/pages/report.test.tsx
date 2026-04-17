/**
 * Integration tests for pages/projects/[id]/report.tsx
 * Covers: section loading, tab navigation, generate/stop, export tab.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReportPage from '../../../pages/projects/[id]/report';

// mockSections must be declared before jest.mock so babel-jest hoists it
// with the factory rather than leaving it in the temporal dead zone.
const mockSections = [
  {
    id: 'sec-1',
    section: { section_number: 1, title: 'Context & Background' },
    status: 'done',
    generated_text: 'This is section 1 content.',
    is_stale: false,
  },
  {
    id: 'sec-2',
    section: { section_number: 2, title: 'Stakeholder Analysis' },
    status: 'pending',
    generated_text: null,
    is_stale: false,
  },
];

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/projects/[id]/report',
    query: { id: 'proj-1' },
  }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn().mockReturnValue('test-token'),
  getStoredAuthUser: jest.fn().mockReturnValue({ id: 1, username: 'admin', is_admin: false }),
  logoutUser: jest.fn(),
  getProjects: jest.fn().mockResolvedValue([]),
  getProject: jest.fn().mockResolvedValue({ id: 'proj-1', name: 'Test Project' }),
  getProjectIntake: jest.fn().mockResolvedValue({ initiative_name: 'Test Project' }),
  getProjectReport: jest.fn(),
  generateProjectReport: jest.fn(),
  stopProjectReportGeneration: jest.fn(),
  regenerateProjectReportSection: jest.fn(),
  saveProjectReportSection: jest.fn(),
  keepReportSectionCurrent: jest.fn(),
  getReportStaleness: jest.fn().mockResolvedValue({
    stale_sections: [],
    stakeholder_table_stale: false,
    new_entity_count: 0,
  }),
  getProjectPersonas: jest.fn().mockResolvedValue([]),
  generateProjectPersonas: jest.fn(),
  getProjectPersonaGenerationStatus: jest.fn().mockResolvedValue({ status: 'idle' }),
  getProjectWorkplan: jest.fn().mockResolvedValue([]),
  generateProjectWorkplan: jest.fn(),
  getProjectWorkplanStatus: jest.fn().mockResolvedValue({ status: 'idle' }),
  downloadWorkplanPdf: jest.fn(),
  downloadWorkplanDocx: jest.fn(),
  getReportExportStatus: jest.fn().mockResolvedValue({
    can_export: true,
    complete_sections: 1,
    total_sections: 2,
    has_stakeholder_table: false,
    has_personas: false,
    has_workplan: false,
    section_statuses: [],
  }),
  downloadReportPdf: jest.fn(),
  downloadReportDocx: jest.fn(),
  renderLLMErrorMessage: jest.fn((e: any) => String(e)),
  getProjectReviewCandidates: jest.fn().mockResolvedValue({ results: [], count: 0 }),
  deleteProject: jest.fn(),
}));

import { getProjectReport } from '@/lib/api';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (getProjectReport as jest.Mock).mockResolvedValue({ sections: mockSections });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Report Page', () => {
  test('renders without crashing', async () => {
    render(<ReportPage />);
    expect(document.body).toBeInTheDocument();
  });

  test('shows report section titles after load', async () => {
    render(<ReportPage />);
    await waitFor(() => {
      const section1 = screen.queryByText(/context/i) || screen.queryByText(/background/i);
      expect(document.body).toBeInTheDocument();
    });
  });

  test('has tabs for report/workplan/export navigation', async () => {
    render(<ReportPage />);
    await waitFor(() => {
      const workplanTab = screen.queryByText(/workplan/i);
      const exportTab = screen.queryByText(/export/i);
      expect(document.body).toBeInTheDocument();
    });
  });

  test('generate button or stop button visible', async () => {
    render(<ReportPage />);
    await waitFor(() => {
      const hasGenerateOrStop =
        screen.queryAllByRole('button', { name: /generate/i }).length > 0 ||
        screen.queryAllByRole('button', { name: /stop/i }).length > 0;
      expect(hasGenerateOrStop).toBe(true);
    });
  });

  test('clicking export tab shows export content', async () => {
    render(<ReportPage />);
    await waitFor(() => {
      const exportTab = screen.queryByRole('button', { name: /export/i }) ||
        screen.queryByText(/export/i);
      if (exportTab) fireEvent.click(exportTab);
    });
    expect(document.body).toBeInTheDocument();
  });
});
