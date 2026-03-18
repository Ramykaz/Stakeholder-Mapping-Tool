import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import WorkspacePage from '../../../pages/projects/[id]/workspace';

const mockQuery: Record<string, string> = { id: 'project-1' };

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: mockQuery,
    pathname: '/projects/[id]/workspace',
    push: jest.fn(),
    replace: jest.fn(),
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
  getProject: jest.fn(),
  getProjectConceptNote: jest.fn(),
  getDocuments: jest.fn(),
  getProjectGraph: jest.fn(),
  deleteDocument: jest.fn(),
  uploadDocumentToProject: jest.fn(),
  extractEntitiesForProject: jest.fn(),
}));

import {
  getProject,
  getProjectConceptNote,
  getDocuments,
  getProjectGraph,
} from '@/lib/api';

const mockGetProject = getProject as jest.Mock;
const mockGetProjectConceptNote = getProjectConceptNote as jest.Mock;
const mockGetDocuments = getDocuments as jest.Mock;
const mockGetProjectGraph = getProjectGraph as jest.Mock;
describe('Workspace context links', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetProject.mockResolvedValue({ id: 'project-1', name: 'Sudan Water Resilience' });
    mockGetProjectConceptNote.mockResolvedValue({ content: 'Concept note' });
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
        {
          id: 'n2',
          label: 'MoF',
          data: {
            entity_id: 'n2',
            entity_type: 'ORGANIZATION',
            confidence: 0.91,
            document_id: 'doc-1',
            chunk_id: null,
            raw_mentions_count: 2,
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          label: 'FUNDS',
          confidence: 0.8,
        },
      ],
    });

  });

  it('shows analysis links for full graph and relations table', async () => {
    render(<WorkspacePage />);

    await waitFor(() => {
      expect(screen.getByText('Analysis Views')).toBeTruthy();
    });

    const graphLink = screen.getByRole('link', { name: 'Open Full Graph' });
    const relationLink = screen.getByRole('link', { name: 'Open Relations Table' });
    expect(graphLink.getAttribute('href')).toBe('/graph?project_id=project-1');
    expect(relationLink.getAttribute('href')).toBe('/relations?project_id=project-1');
  });
});
