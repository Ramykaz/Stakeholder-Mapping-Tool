import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import NextStepCard from '@/components/NextStepCard';
import { WorkflowStep } from '@/lib/api';

const mockPush = jest.fn();

const routerState: any = {
  query: { id: 'proj-1' },
  asPath: '/projects/proj-1/documents',
  push: mockPush,
};

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

const baseStep: WorkflowStep = {
  number: 2,
  label: 'Upload documents',
  complete: false,
  url: '/projects/proj-1/documents',
  description: 'Upload files',
};

describe('NextStepCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routerState.query = { id: 'proj-1' };
    routerState.asPath = '/projects/proj-1/documents';
  });

  test('does not render when show=false', () => {
    const { container } = render(<NextStepCard step={baseStep} show={false} />);
    expect(container.firstChild).toBeNull();
  });

  test('derives next step from route on documents page and uses contextual description', () => {
    render(<NextStepCard step={baseStep} />);

    expect(screen.getByText('Run extraction')).toBeInTheDocument();
    expect(
      screen.getByText(/Run extraction to create entities and relationships/i),
    ).toBeInTheDocument();
  });

  test('on map page, uses report-generation contextual description', () => {
    routerState.asPath = '/projects/proj-1/map';
    render(<NextStepCard step={baseStep} />);

    expect(screen.getByText('Generate report')).toBeInTheDocument();
    expect(
      screen.getByText(/Generate report sections from the graph insights/i),
    ).toBeInTheDocument();
  });

  test('clicking CTA navigates to effective step URL', () => {
    render(<NextStepCard step={baseStep} />);

    fireEvent.click(screen.getByRole('button', { name: /Go to Run extraction/i }));
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/analyze');
  });

  test('falls back to provided step when project id is unavailable', () => {
    routerState.query = {};
    routerState.asPath = '/documents';

    render(<NextStepCard step={baseStep} />);

    expect(screen.getByText('Upload documents')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Go to Upload documents/i }));
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/documents');
  });
});
