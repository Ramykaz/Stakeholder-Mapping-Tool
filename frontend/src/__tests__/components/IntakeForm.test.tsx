import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IntakeForm from '@/components/IntakeForm';

jest.mock('@/lib/api', () => ({
  getProjectIntake: jest.fn(),
  getProjectContextPreview: jest.fn(),
  upsertProjectIntake: jest.fn(),
}));

import {
  getProjectIntake,
  getProjectContextPreview,
  upsertProjectIntake,
} from '@/lib/api';

const mockGetProjectIntake = getProjectIntake as jest.Mock;
const mockGetContextPreview = getProjectContextPreview as jest.Mock;
const mockUpsertProjectIntake = upsertProjectIntake as jest.Mock;

const baseProfile = {
  id: 'int-1',
  project: 'proj-1',
  initiative_name: 'AI for Good Hackathon',
  host_organization: 'UNDP SDG AI Lab',
  country: 'Uzbekistan',
  geography: 'Central Asia',
  thematic_area: 'Youth Employment',
  core_objectives: 'Support youth innovation.',
  expected_outcomes: 'Improved startup readiness.',
  target_beneficiaries: 'Young entrepreneurs',
  success_metrics: 'Number of viable prototypes',
  stakeholder_focus: 'Public and private incubators',
  updated_at: null,
};

describe('IntakeForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProjectIntake.mockResolvedValue(baseProfile);
    mockGetContextPreview.mockResolvedValue({ context: 'Context preview text' });
    mockUpsertProjectIntake.mockResolvedValue(baseProfile);
  });

  test('shows loading state then renders loaded profile and context preview', async () => {
    render(<IntakeForm projectId="proj-1" />);

    expect(screen.getByText(/Loading initiative profile/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetProjectIntake).toHaveBeenCalledWith('proj-1');
      expect(mockGetContextPreview).toHaveBeenCalledWith('proj-1');
      expect(screen.getByDisplayValue('AI for Good Hackathon')).toBeInTheDocument();
      expect(screen.getByText('Context preview text')).toBeInTheDocument();
    });
  });

  test('save button is disabled until title changes from baseline', async () => {
    render(<IntakeForm projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Initiative Profile' })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: 'Save Initiative Profile' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('AI for Good Hackathon'), {
      target: { value: 'AI for Good Hackathon 2026' },
    });

    expect(saveButton).not.toBeDisabled();
  });

  test('onDirtyChange emits false initially then true after edit', async () => {
    const onDirtyChange = jest.fn();

    render(<IntakeForm projectId="proj-1" onDirtyChange={onDirtyChange} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('AI for Good Hackathon')).toBeInTheDocument();
    });

    expect(onDirtyChange).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByPlaceholderText('UNDP SDG AI Lab'), {
      target: { value: 'UNDP Innovation Lab' },
    });

    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    });
  });

  test('successful save calls API with payload and shows success message', async () => {
    const saved = {
      ...baseProfile,
      initiative_name: 'New Initiative Name',
    };
    mockUpsertProjectIntake.mockResolvedValue(saved);
    mockGetContextPreview.mockResolvedValueOnce({ context: 'Context preview text' }).mockResolvedValueOnce({ context: 'Updated context' });

    render(<IntakeForm projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('AI for Good Hackathon')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('AI for Good Hackathon'), {
      target: { value: 'New Initiative Name' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Initiative Profile' }));

    await waitFor(() => {
      expect(mockUpsertProjectIntake).toHaveBeenCalledWith('proj-1', expect.objectContaining({
        initiative_name: 'New Initiative Name',
        host_organization: 'UNDP SDG AI Lab',
      }));
      expect(screen.getByText(/Initiative profile saved/i)).toBeInTheDocument();
      expect(screen.getByText('Updated context')).toBeInTheDocument();
    });
  });

  test('shows load error when intake fetch fails', async () => {
    mockGetProjectIntake.mockRejectedValueOnce(new Error('load failed'));

    render(<IntakeForm projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load initiative profile/i)).toBeInTheDocument();
    });
  });

  test('shows save error when upsert fails', async () => {
    mockUpsertProjectIntake.mockRejectedValueOnce(new Error('save failed'));

    render(<IntakeForm projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('AI for Good Hackathon')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('AI for Good Hackathon'), {
      target: { value: 'Changed title' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Initiative Profile' }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to save initiative profile/i)).toBeInTheDocument();
    });
  });
});
