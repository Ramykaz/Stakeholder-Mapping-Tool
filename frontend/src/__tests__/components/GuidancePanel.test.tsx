/**
 * Integration tests for src/components/GuidancePanel.tsx
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GuidancePanel from '@/components/GuidancePanel';

jest.mock('@/lib/api', () => ({
  getProjectGuidance: jest.fn(),
  createProjectGuidance: jest.fn(),
  deleteProjectGuidance: jest.fn(),
  updateProjectGuidance: jest.fn(),
  reorderProjectGuidance: jest.fn(),
}));

import {
  getProjectGuidance,
  createProjectGuidance,
  deleteProjectGuidance,
  updateProjectGuidance,
  reorderProjectGuidance,
} from '@/lib/api';

const mockGetGuidance = getProjectGuidance as jest.Mock;
const mockCreateGuidance = createProjectGuidance as jest.Mock;
const mockDeleteGuidance = deleteProjectGuidance as jest.Mock;
const mockUpdateGuidance = updateProjectGuidance as jest.Mock;
const mockReorderGuidance = reorderProjectGuidance as jest.Mock;

const sampleItems = [
  { id: 'g1', text: 'Focus on public institutions', enabled: true, order: 0, source: 'manual' },
  { id: 'g2', text: 'Ignore private sector', enabled: false, order: 1, source: 'manual' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGuidance.mockResolvedValue({ results: sampleItems });
  mockCreateGuidance.mockResolvedValue({ id: 'g3', text: 'New item', enabled: true, order: 2, source: 'manual' });
  mockDeleteGuidance.mockResolvedValue(undefined);
  mockUpdateGuidance.mockResolvedValue(sampleItems[0]);
  mockReorderGuidance.mockResolvedValue(undefined);
});

describe('GuidancePanel — loading', () => {
  test('shows loading text initially', () => {
    mockGetGuidance.mockReturnValue(new Promise(() => {}));
    render(<GuidancePanel projectId="proj-1" />);
    expect(screen.getByText(/loading extraction guidance/i)).toBeInTheDocument();
  });
});

describe('GuidancePanel — loaded state', () => {
  test('renders guidance items', async () => {
    render(<GuidancePanel projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Focus on public institutions')).toBeInTheDocument();
    });
  });

  test('shows "No guidance added yet" when items are empty', async () => {
    mockGetGuidance.mockResolvedValue({ results: [] });
    render(<GuidancePanel projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByText(/no guidance added yet/i)).toBeInTheDocument();
    });
  });

  test('add button is disabled when input is empty', async () => {
    render(<GuidancePanel projectId="proj-1" />);
    await waitFor(() => screen.getByRole('button', { name: /add/i }));
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
  });

  test('add button enables when input has text', async () => {
    render(<GuidancePanel projectId="proj-1" />);
    await waitFor(() => screen.getByPlaceholderText(/prioritize/i));
    fireEvent.change(screen.getByPlaceholderText(/prioritize/i), { target: { value: 'New guidance' } });
    expect(screen.getByRole('button', { name: /add/i })).not.toBeDisabled();
  });

  test('clicking Add calls createProjectGuidance and shows new item', async () => {
    render(<GuidancePanel projectId="proj-1" />);
    await waitFor(() => screen.getByPlaceholderText(/prioritize/i));
    fireEvent.change(screen.getByPlaceholderText(/prioritize/i), { target: { value: 'New item' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => {
      expect(mockCreateGuidance).toHaveBeenCalledWith('proj-1', { text: 'New item' });
    });
  });

  test('clicking Delete calls deleteProjectGuidance', async () => {
    render(<GuidancePanel projectId="proj-1" />);
    await waitFor(() => screen.getAllByRole('button', { name: /delete/i }));
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(mockDeleteGuidance).toHaveBeenCalledWith('proj-1', 'g1');
    });
  });

  test('shows error message when load fails', async () => {
    mockGetGuidance.mockRejectedValue(new Error('API Error'));
    render(<GuidancePanel projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load extraction guidance/i)).toBeInTheDocument();
    });
  });
});
