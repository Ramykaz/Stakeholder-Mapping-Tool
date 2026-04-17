import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportPage from '../../../pages/projects/[id]/report';

const mockReplace = jest.fn();

const routerState: any = {
  pathname: '/projects/[id]/report',
  query: { id: 'proj-1', tab: 'report' },
  replace: mockReplace,
  push: jest.fn(),
};

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/components/Layout', () => function MockLayout({ children }: any) {
  return <div>{children}</div>;
});

jest.mock('@/components/ReportSectionCard', () => function MockCard({ section, onRegenerate }: any) {
  return (
    <div>
      <span>{section.section_title}</span>
      <button onClick={() => onRegenerate(section.section_id)}>Regenerate section</button>
    </div>
  );
});

jest.mock('@/components/PersonaCard', () => ({
  __esModule: true,
  default: function MockPersona({ persona }: any) {
    return <div>{persona.persona_name}</div>;
  },
  PersonaCardSkeleton: function MockPersonaSkeleton() {
    return <div>Persona skeleton</div>;
  },
}));

jest.mock('@/components/WorkplanAccordion', () => ({
  __esModule: true,
  default: function MockWorkplan({ components }: any) {
    return <div>Workplan components: {components.length}</div>;
  },
  WorkplanAccordionSkeleton: function MockWorkplanSkeleton() {
    return <div>Workplan loading</div>;
  },
}));

jest.mock('@/components/StalenessNotice', () => function MockStale({ onRegenerate, onKeepCurrent }: any) {
  return (
    <div>
      <button onClick={onRegenerate}>Regenerate stale</button>
      <button onClick={onKeepCurrent}>Keep stale</button>
    </div>
  );
});

jest.mock('@/components/ExportTab', () => function MockExportTab() {
  return <div>Export tab rendered</div>;
});

jest.mock('@/lib/api', () => ({
  getProject: jest.fn().mockResolvedValue({ id: 'proj-1', name: 'Test Project' }),
  getProjectIntake: jest.fn().mockResolvedValue({ initiative_name: 'Initiative' }),
  generateProjectReport: jest.fn(),
  generateProjectPersonas: jest.fn(),
  generateProjectWorkplan: jest.fn(),
  downloadWorkplanPdf: jest.fn(),
  downloadWorkplanDocx: jest.fn(),
  getProjectPersonaGenerationStatus: jest.fn(),
  getProjectPersonas: jest.fn(),
  getProjectReport: jest.fn(),
  getReportStaleness: jest.fn(),
  getProjectWorkplan: jest.fn(),
  getProjectWorkplanStatus: jest.fn(),
  keepReportSectionCurrent: jest.fn(),
  stopProjectReportGeneration: jest.fn(),
  renderLLMErrorMessage: jest.fn((e: any) => String(e?.message || e || 'error')),
  saveProjectReportSection: jest.fn(),
  regenerateProjectReportSection: jest.fn(),
}));

import {
  getProjectReport,
  getReportStaleness,
  getProjectPersonas,
  getProjectPersonaGenerationStatus,
  getProjectWorkplan,
  getProjectWorkplanStatus,
  regenerateProjectReportSection,
  keepReportSectionCurrent,
  generateProjectWorkplan,
  downloadWorkplanPdf,
  downloadWorkplanDocx,
} from '@/lib/api';

const mockGetReport = getProjectReport as jest.Mock;
const mockGetStaleness = getReportStaleness as jest.Mock;
const mockGetPersonas = getProjectPersonas as jest.Mock;
const mockPersonaStatus = getProjectPersonaGenerationStatus as jest.Mock;
const mockGetWorkplan = getProjectWorkplan as jest.Mock;
const mockWorkplanStatus = getProjectWorkplanStatus as jest.Mock;
const mockRegenerate = regenerateProjectReportSection as jest.Mock;
const mockKeepCurrent = keepReportSectionCurrent as jest.Mock;
const mockGenerateWorkplan = generateProjectWorkplan as jest.Mock;
const mockDownloadPdf = downloadWorkplanPdf as jest.Mock;
const mockDownloadDocx = downloadWorkplanDocx as jest.Mock;

describe('Report page advanced actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetReport.mockResolvedValue({
      sections: [
        {
          section_id: 'sec-1',
          section_number: 1,
          section_title: 'Context',
          status: 'done',
          generated_text: 'Done text',
          is_stale: true,
        },
      ],
    });
    mockGetStaleness.mockResolvedValue({
      stale_sections: [1],
      stakeholder_table_stale: false,
      new_entity_count: 2,
    });
    mockGetPersonas.mockResolvedValue({ results: [] });
    mockPersonaStatus.mockResolvedValue({ generation_status: 'idle', generation_message: '' });
    mockGetWorkplan.mockResolvedValue({ generated: true, components: [{ id: 'c1', title: 'Phase 1', tasks: [] }] });
    mockWorkplanStatus.mockResolvedValue({
      section_6_complete: true,
      generation_status: 'completed',
      generation_message: '',
    });

    mockRegenerate.mockResolvedValue({});
    mockKeepCurrent.mockResolvedValue({});
    mockGenerateWorkplan.mockResolvedValue({});
    mockDownloadPdf.mockResolvedValue(undefined);
    mockDownloadDocx.mockResolvedValue(undefined);

    routerState.query = { id: 'proj-1', tab: 'report' };
  });

  test('regenerates and keeps stale sections from report tab notice', async () => {
    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Regenerate stale' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate stale' }));

    await waitFor(() => {
      expect(mockRegenerate).toHaveBeenCalledWith('proj-1', 'sec-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Keep stale' }));

    await waitFor(() => {
      expect(mockKeepCurrent).toHaveBeenCalledWith('proj-1', 'sec-1');
    });
  });

  test('workplan tab generates and exports workplan files', async () => {
    routerState.query = { id: 'proj-1', tab: 'workplan' };
    render(<ReportPage />);

    const generateBtn = await screen.findByRole('button', { name: 'Generate workplan' });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockGenerateWorkplan).toHaveBeenCalledWith('proj-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download workplan PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download workplan DOCX' }));

    await waitFor(() => {
      expect(mockDownloadPdf).toHaveBeenCalledWith('proj-1');
      expect(mockDownloadDocx).toHaveBeenCalledWith('proj-1');
    });
  });

  test('switches to export tab and renders export panel', async () => {
    routerState.query = { id: 'proj-1', tab: 'export' };
    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Export tab rendered')).toBeInTheDocument();
    });
  });
});
