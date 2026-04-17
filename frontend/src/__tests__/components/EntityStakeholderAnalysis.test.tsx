import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EntityStakeholderAnalysis from '@/components/EntityStakeholderAnalysis';

const mockPush = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('EntityStakeholderAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows generation CTA when no data and no stakeholder table', () => {
    render(
      <EntityStakeholderAnalysis
        projectId="proj-1"
        stakeholderPriority={null}
        persona={null}
        appearsInReportSections={[]}
        hasStakeholderTable={false}
      />,
    );

    const cta = screen.getByRole('button', {
      name: /Generate stakeholder table to see priority analysis/i,
    });
    fireEvent.click(cta);
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/stakeholders');
  });

  test('shows not-ranked message when table exists but entity has no analysis', () => {
    render(
      <EntityStakeholderAnalysis
        projectId="proj-1"
        stakeholderPriority={null}
        persona={null}
        appearsInReportSections={[]}
        hasStakeholderTable={true}
      />,
    );

    expect(screen.getByText(/Not ranked in the top stakeholders/i)).toBeInTheDocument();
  });

  test('renders stakeholder priority reason and ask', () => {
    render(
      <EntityStakeholderAnalysis
        projectId="proj-1"
        stakeholderPriority={{
          rank: 2,
          category: 'Public Sector',
          priority: 'High',
          priority_reason: 'Strong policy influence',
          ask_request: 'Co-sponsor implementation guidance',
        }}
        persona={null}
        appearsInReportSections={[]}
        hasStakeholderTable={true}
      />,
    );

    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Public Sector')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('Strong policy influence')).toBeInTheDocument();
    expect(screen.getByText('Co-sponsor implementation guidance')).toBeInTheDocument();
  });

  test('navigates to report section when section chip is clicked', () => {
    render(
      <EntityStakeholderAnalysis
        projectId="proj-1"
        stakeholderPriority={null}
        persona={null}
        appearsInReportSections={[
          { section_number: 3, report_chapter_title: 'Findings' },
        ]}
        hasStakeholderTable={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /§3 Findings/i }));
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/report#section-3');
  });

  test('navigates to personas anchor when persona name is clicked', () => {
    render(
      <EntityStakeholderAnalysis
        projectId="proj-1"
        stakeholderPriority={null}
        persona={{ archetype_label: 'Bridge Builder', persona_name: 'Amina' }}
        appearsInReportSections={[]}
        hasStakeholderTable={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Amina' }));
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/report#personas');
  });
});
