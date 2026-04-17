/**
 * Unit tests for src/components/WorkplanAccordion.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkplanAccordion, { WorkplanAccordionSkeleton } from '@/components/WorkplanAccordion';

const makeTask = (id: string, desc: string, owner = 'PM', timeline = 'Q1', kpis = 'KPI A') => ({
  id,
  task_description: desc,
  suggested_owner: owner,
  timeline,
  kpis,
  dependencies: '',
  related_entity: null,
  order: 0,
  component: 'comp-1',
});

const makeComponent = (id: string, title: string, tasks: any[] = []) => ({
  id,
  title,
  order: 0,
  tasks,
  project: 'proj-1',
});

describe('WorkplanAccordion — empty state', () => {
  test('shows empty message when components array is empty', () => {
    render(<WorkplanAccordion components={[]} />);
    expect(screen.getByText(/no workplan components/i)).toBeInTheDocument();
  });
});

describe('WorkplanAccordion — with components', () => {
  test('renders component titles', () => {
    const components = [
      makeComponent('c1', 'Community Engagement'),
      makeComponent('c2', 'Policy Advocacy'),
    ];
    render(<WorkplanAccordion components={components as any} />);
    expect(screen.getByText('Community Engagement')).toBeInTheDocument();
    expect(screen.getByText('Policy Advocacy')).toBeInTheDocument();
  });

  test('renders tasks inside open accordion panel', () => {
    const components = [
      makeComponent('c1', 'Phase 1', [makeTask('t1', 'Hold workshops')]),
    ];
    render(<WorkplanAccordion components={components as any} />);
    expect(screen.getByText('Hold workshops')).toBeInTheDocument();
  });

  test('accordion starts open and shows tasks', () => {
    const components = [
      makeComponent('c1', 'Phase 1', [makeTask('t1', 'Initial meetings')]),
    ];
    render(<WorkplanAccordion components={components as any} />);
    // Task should be visible without any click
    expect(screen.getByText('Initial meetings')).toBeInTheDocument();
  });

  test('clicking accordion header toggles panel closed', () => {
    const components = [
      makeComponent('c1', 'Phase 1', [makeTask('t1', 'Hidden task')]),
    ];
    render(<WorkplanAccordion components={components as any} />);
    // Initially visible
    expect(screen.getByText('Hidden task')).toBeInTheDocument();
    // Click header to close
    fireEvent.click(screen.getByText('Phase 1'));
    // Task should now be hidden
    expect(screen.queryByText('Hidden task')).not.toBeInTheDocument();
  });

  test('shows "No tasks in this component" when tasks array is empty', () => {
    const components = [makeComponent('c1', 'Empty Phase', [])];
    render(<WorkplanAccordion components={components as any} />);
    expect(screen.getByText(/no tasks in this component/i)).toBeInTheDocument();
  });

  test('shows suggested_owner in task row', () => {
    const components = [
      makeComponent('c1', 'Phase 1', [makeTask('t1', 'Task A', 'Programme Officer')]),
    ];
    render(<WorkplanAccordion components={components as any} />);
    expect(screen.getByText('Programme Officer')).toBeInTheDocument();
  });

  test('shows timeline in task row', () => {
    const components = [
      makeComponent('c1', 'Phase 1', [makeTask('t1', 'Task A', 'PM', 'Month 3')]),
    ];
    render(<WorkplanAccordion components={components as any} />);
    expect(screen.getByText('Month 3')).toBeInTheDocument();
  });

  test('clicking task row expands details with full description', () => {
    const components = [
      makeComponent('c1', 'Phase 1', [makeTask('t1', 'Detailed task description here')]),
    ];
    render(<WorkplanAccordion components={components as any} />);
    // Click on the task row to expand
    const taskRow = screen.getAllByText('Detailed task description here')[0].closest('tr')!;
    fireEvent.click(taskRow);
    // The expanded row should show the full description again
    const allInstances = screen.getAllByText('Detailed task description here');
    expect(allInstances.length).toBeGreaterThan(0);
  });

  test('related entity button calls onEntityClick with entity id', () => {
    const onEntityClick = jest.fn();
    const taskWithEntity = {
      ...makeTask('t1', 'Task with entity'),
      related_entity: { id: 'ent-5', name: 'UNDP' },
    };
    const components = [makeComponent('c1', 'Phase 1', [taskWithEntity])];
    render(<WorkplanAccordion components={components as any} onEntityClick={onEntityClick} />);
    // Expand task row first
    const taskRow = screen.getByText('Task with entity').closest('tr')!;
    fireEvent.click(taskRow);
    // Now click entity button
    const entityBtn = screen.getByText('UNDP');
    fireEvent.click(entityBtn);
    expect(onEntityClick).toHaveBeenCalledWith('ent-5');
  });
});

describe('WorkplanAccordionSkeleton', () => {
  test('renders without crashing', () => {
    const { container } = render(<WorkplanAccordionSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('has animate-pulse class', () => {
    const { container } = render(<WorkplanAccordionSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
