import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EntityLabelsPanel from '@/components/admin/EntityLabelsPanel';

const sampleLabels = [
  {
    id: 'l1',
    name: 'Organization',
    description: 'Institutions and groups',
    node_shape: 'ellipse',
    color: '#2563eb',
    active: true,
    display_order: 1,
  },
];

describe('EntityLabelsPanel', () => {
  const onCreate = jest.fn().mockResolvedValue(undefined);
  const onUpdate = jest.fn().mockResolvedValue(undefined);
  const onDelete = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders label count and existing rows', () => {
    render(
      <EntityLabelsPanel
        labels={sampleLabels as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText(/1 total/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Organization')).toBeInTheDocument();
  });

  test('create form calls onCreate and resets fields', async () => {
    render(
      <EntityLabelsPanel
        labels={sampleLabels as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    const nameInput = screen.getByLabelText('New entity label name');
    fireEvent.change(nameInput, { target: { value: 'Community Group' } });
    fireEvent.change(screen.getByLabelText('New entity label description'), {
      target: { value: 'Grassroots organizations' },
    });

    fireEvent.click(screen.getByRole('button', { name: /\+ Add/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Community Group',
          description: 'Grassroots organizations',
        }),
      );
      expect((nameInput as HTMLInputElement).value).toBe('');
    });
  });

  test('editing an existing row shows Save and calls onUpdate', async () => {
    render(
      <EntityLabelsPanel
        labels={sampleLabels as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    fireEvent.change(screen.getByLabelText('Entity label name'), {
      target: { value: 'Organization Updated' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({ name: 'Organization Updated' }),
      );
    });
  });

  test('delete button calls onDelete', async () => {
    render(
      <EntityLabelsPanel
        labels={sampleLabels as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('l1');
    });
  });

  test('readOnly mode hides form and CRUD actions', () => {
    render(
      <EntityLabelsPanel
        labels={sampleLabels as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        readOnly={true}
      />,
    );

    expect(screen.queryByLabelText('New entity label name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
  });
});
