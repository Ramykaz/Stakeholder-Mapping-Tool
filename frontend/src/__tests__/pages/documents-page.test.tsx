import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentsPage from '../../../pages/projects/[id]/documents';

const mockPush = jest.fn();
const mockReplace = jest.fn();

const routerState: any = {
  query: { id: 'proj-1' },
  push: mockPush,
  replace: mockReplace,
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

jest.mock('@/components/EmptyState', () => function MockEmptyState({ title }: any) {
  return <div>{title}</div>;
});

jest.mock('@/components/ErrorMessage', () => function MockError({ message }: any) {
  return <div>{message}</div>;
});

jest.mock('@/lib/api', () => ({
  getProject: jest.fn(),
  getProjectDocuments: jest.fn(),
  getProjectDocumentsWithStats: jest.fn(),
  getProjectWorkflow: jest.fn(),
  getReportStaleness: jest.fn(),
  uploadDocumentToProject: jest.fn(),
  deleteProjectDocument: jest.fn(),
  getProjectWebSources: jest.fn(),
  createProjectWebSource: jest.fn(),
  deleteProjectWebSource: jest.fn(),
  getProjectDocumentStatus: jest.fn(),
  getProjectExtractionStatus: jest.fn(),
  reextractProjectDocument: jest.fn(),
  getProjectDocumentEntities: jest.fn(),
  getProjectDocumentRelationships: jest.fn(),
  getProjectDocumentContext: jest.fn(),
  updateProjectEntity: jest.fn(),
  deleteProjectDocumentEntity: jest.fn(),
  updateProjectDocumentRelationship: jest.fn(),
  deleteProjectDocumentRelationship: jest.fn(),
  getStoredAuthToken: jest.fn(),
  renderLLMErrorMessage: jest.fn((err: any) => String(err?.message || err || 'error')),
}));

import {
  getProject,
  getProjectDocuments,
  getProjectDocumentsWithStats,
  getProjectWorkflow,
  getProjectWebSources,
  getProjectExtractionStatus,
  getStoredAuthToken,
  createProjectWebSource,
  reextractProjectDocument,
  getReportStaleness,
} from '@/lib/api';

const mockGetProject = getProject as jest.Mock;
const mockGetProjectDocuments = getProjectDocuments as jest.Mock;
const mockGetProjectDocumentsWithStats = getProjectDocumentsWithStats as jest.Mock;
const mockGetProjectWorkflow = getProjectWorkflow as jest.Mock;
const mockGetProjectWebSources = getProjectWebSources as jest.Mock;
const mockGetProjectExtractionStatus = getProjectExtractionStatus as jest.Mock;
const mockGetStoredAuthToken = getStoredAuthToken as jest.Mock;
const mockCreateProjectWebSource = createProjectWebSource as jest.Mock;
const mockReextractProjectDocument = reextractProjectDocument as jest.Mock;
const mockGetReportStaleness = getReportStaleness as jest.Mock;

describe('Documents page interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStoredAuthToken.mockReturnValue('token');
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Coverage Project' });
    mockGetProjectWorkflow.mockResolvedValue({
      current_step: 2,
      next_step: { number: 3, label: 'Run extraction', url: '/projects/proj-1/analyze' },
      steps: [],
    });
    mockGetProjectDocuments.mockResolvedValue([
      {
        id: 'doc-1',
        filename: 'briefing.txt',
        file_format: 'txt',
        processing_status: 'completed',
        extraction_state: 'idle',
        entity_count: 0,
        relation_count: 0,
        extracted_at: null,
        upload_timestamp: '2026-04-15T10:00:00Z',
      },
    ]);
    mockGetProjectDocumentsWithStats.mockResolvedValue([]);
    mockGetProjectWebSources.mockResolvedValue([]);
    mockGetProjectExtractionStatus.mockResolvedValue({ status: 'idle' });
    mockGetReportStaleness.mockResolvedValue({ stale_sections: [] });
    mockCreateProjectWebSource.mockResolvedValue({ id: 'ws-1' });
    mockReextractProjectDocument.mockResolvedValue({ status: 'queued' });
  });

  test('submits URL source payload from URL tab', async () => {
    render(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'URL' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'URL' }));
    fireEvent.change(screen.getByPlaceholderText('https://example.org/article'), {
      target: { value: 'https://example.org/article-1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add URL' }));

    await waitFor(() => {
      expect(mockCreateProjectWebSource).toHaveBeenCalledWith('proj-1', {
        source_type: 'url',
        url: 'https://example.org/article-1',
      });
    });
  });

  test('submits pasted text payload from Paste tab', async () => {
    render(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Paste text' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Paste text' }));
    fireEvent.change(screen.getByPlaceholderText('Title'), {
      target: { value: 'Field Visit Notes' },
    });
    fireEvent.change(screen.getByPlaceholderText('Paste text to ingest'), {
      target: { value: 'UNDP and WHO coordinate implementation.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Pasted Text' }));

    await waitFor(() => {
      expect(mockCreateProjectWebSource).toHaveBeenCalledWith('proj-1', {
        source_type: 'paste',
        title: 'Field Visit Notes',
        raw_text: 'UNDP and WHO coordinate implementation.',
      });
    });
  });

  test('analyzes a completed unextracted document from row action', async () => {
    render(<DocumentsPage />);

    const analyzeBtn = await screen.findByRole('button', { name: 'Analyze now' });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(mockReextractProjectDocument).toHaveBeenCalledWith('proj-1', 'doc-1');
    });
  });
});
