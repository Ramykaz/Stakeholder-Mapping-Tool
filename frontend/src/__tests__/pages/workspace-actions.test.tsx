import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkspacePage from '../../../pages/projects/[id]/workspace';

const mockPush = jest.fn();

const routerState: any = {
  query: { id: 'project-1' },
  pathname: '/projects/[id]/workspace',
  push: mockPush,
  replace: jest.fn(),
};

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/components/Layout', () => function MockLayout({ children }: any) {
  return <div>{children}</div>;
});

jest.mock('@/lib/api', () => ({
  getProject: jest.fn(),
  getProjectConceptNote: jest.fn(),
  getDocuments: jest.fn(),
  getProjectGraph: jest.fn(),
  deleteDocument: jest.fn(),
  uploadDocumentToProject: jest.fn(),
  extractEntitiesForProject: jest.fn(),
  generateEntitySummary: jest.fn(),
  getEntityProfile: jest.fn(),
}));

import {
  getProject,
  getProjectConceptNote,
  getDocuments,
  getProjectGraph,
  extractEntitiesForProject,
} from '@/lib/api';

const mockGetProject = getProject as jest.Mock;
const mockGetProjectConceptNote = getProjectConceptNote as jest.Mock;
const mockGetDocuments = getDocuments as jest.Mock;
const mockGetProjectGraph = getProjectGraph as jest.Mock;
const mockExtract = extractEntitiesForProject as jest.Mock;

describe('Workspace page command flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routerState.query = { id: 'project-1' };

    mockGetProject.mockResolvedValue({ id: 'project-1', name: 'Test Project' });
    mockGetProjectConceptNote.mockResolvedValue({ content: 'Concept text' });
    mockGetDocuments.mockResolvedValue([
      {
        id: 'doc-1',
        project_id: 'project-1',
        filename: 'a.txt',
        entity_count: 2,
        relation_count: 1,
      },
    ]);
    mockGetProjectGraph.mockResolvedValue({
      nodes: [
        {
          id: 'n1',
          label: 'UNDP',
          data: {
            entity_id: 'n1',
            entity_type: 'ORGANIZATION',
            confidence: 0.95,
            document_id: 'doc-1',
            chunk_id: null,
            raw_mentions_count: 3,
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n1', label: 'SELF', confidence: 0.6 },
      ],
    });
    mockExtract.mockResolvedValue({
      documents_processed: 1,
      entities_created: 4,
      relations_created: 2,
      provider: 'openai',
    });
  });

  test('chat command "open relations" navigates with selected document id', async () => {
    render(<WorkspacePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/try: extract selected/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/try: extract selected/i), {
      target: { value: 'open relations' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects/project-1/map');
    });
  });

  test('extract all uses selected provider/model payload', async () => {
    render(<WorkspacePage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'LLM provider' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'LLM provider' }), {
      target: { value: 'openai' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Model' }), {
      target: { value: 'gpt-5-nano' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Extract All Docs' }));

    await waitFor(() => {
      expect(mockExtract).toHaveBeenCalledWith('project-1', undefined, {
        provider: 'openai',
        model: 'gpt-5-nano',
      });
    });
  });
});
