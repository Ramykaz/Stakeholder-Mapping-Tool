import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsPage from '../../../pages/projects/[id]/settings';

const mockPush = jest.fn();

const routerState: any = {
  query: { id: 'proj-1' },
  push: mockPush,
  replace: jest.fn(),
};

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

jest.mock('@/components/Layout', () => function MockLayout({ children }: any) {
  return <div>{children}</div>;
});

jest.mock('@/components/GuidancePanel', () => function MockGuidancePanel() {
  return <div data-testid="guidance-panel" />;
});

jest.mock('@/lib/api', () => ({
  deleteProject: jest.fn(),
  getProject: jest.fn(),
  getProjectConceptNote: jest.fn(),
  getProjectProviders: jest.fn(),
  updateProjectProvider: jest.fn(),
  updateProject: jest.fn(),
  upsertProjectConceptNote: jest.fn(),
  testLLMConnection: jest.fn(),
}));

import {
  deleteProject,
  getProject,
  getProjectConceptNote,
  getProjectProviders,
  updateProjectProvider,
  updateProject,
  upsertProjectConceptNote,
  testLLMConnection,
} from '@/lib/api';

const mockDeleteProject = deleteProject as jest.Mock;
const mockGetProject = getProject as jest.Mock;
const mockGetConcept = getProjectConceptNote as jest.Mock;
const mockGetProviders = getProjectProviders as jest.Mock;
const mockUpdateProvider = updateProjectProvider as jest.Mock;
const mockUpdateProject = updateProject as jest.Mock;
const mockUpsertConcept = upsertProjectConceptNote as jest.Mock;
const mockTestConnection = testLLMConnection as jest.Mock;

describe('Project settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Coverage Project', description: 'desc' });
    mockGetConcept.mockResolvedValue({ content: 'Concept baseline' });
    mockGetProviders.mockResolvedValue({
      current_provider: 'groq',
      current_model: 'llama3-8b-8192',
      providers: [
        { name: 'groq', available: true, models: ['llama3-8b-8192'] },
        { name: 'openai', available: true, models: ['gpt-4o-mini', 'gpt-5-mini'] },
      ],
    });
    mockUpdateProvider.mockResolvedValue({});
    mockUpdateProject.mockResolvedValue({});
    mockUpsertConcept.mockResolvedValue({});
    mockTestConnection.mockResolvedValue({ status: 'ok', provider: 'openai', model: 'gpt-5-mini', latency_ms: 120 });
    mockDeleteProject.mockResolvedValue({});
    (global as any).confirm = jest.fn(() => true);
  });

  test('saves provider and triggers connection test', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByTitle('Provider')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTitle('Provider'), {
      target: { value: 'openai' },
    });
    fireEvent.change(screen.getByTitle('Model'), {
      target: { value: 'gpt-5-mini' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Provider' }));

    await waitFor(() => {
      expect(mockUpdateProvider).toHaveBeenCalledWith('proj-1', 'openai', 'gpt-5-mini');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));

    await waitFor(() => {
      expect(mockTestConnection).toHaveBeenCalledWith('openai', 'gpt-5-mini');
      expect(screen.getByText(/Connection successful/i)).toBeInTheDocument();
    });
  });

  test('saves project profile and concept note content', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Project name'), {
      target: { value: 'Coverage Project Updated' },
    });
    fireEvent.change(screen.getByPlaceholderText('Project description'), {
      target: { value: 'Updated description' },
    });
    fireEvent.change(screen.getByPlaceholderText('Update concept note'), {
      target: { value: 'Updated concept note text' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', {
        name: 'Coverage Project Updated',
        description: 'Updated description',
      });
      expect(mockUpsertConcept).toHaveBeenCalledWith('proj-1', {
        content: 'Updated concept note text',
        attachment: null,
      });
    });
  });

  test('deletes project after confirmation and redirects home', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Project' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));

    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('proj-1');
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });
});
