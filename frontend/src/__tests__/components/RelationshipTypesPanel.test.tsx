import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RelationshipTypesPanel from '@/components/admin/RelationshipTypesPanel';

const sampleTypes = [
  {
    id: 'r1',
    name: 'FUNDS',
    description: 'Provides funding',
    directional: true,
    color: '#2563eb',
    active: true,
    display_order: 1,
  },
];

describe('RelationshipTypesPanel', () => {
  const onCreate = jest.fn().mockResolvedValue(undefined);
  const onUpdate = jest.fn().mockResolvedValue(undefined);
  const onDelete = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders count and existing relationship type', () => {
    render(
      <RelationshipTypesPanel
        types={sampleTypes as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText(/1 total/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('FUNDS')).toBeInTheDocument();
  });

  test('create calls onCreate with typed payload', async () => {
    render(
      <RelationshipTypesPanel
        types={sampleTypes as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    fireEvent.change(screen.getByLabelText('New relationship type name'), {
      target: { value: 'PARTNERS_WITH' },
    });
    fireEvent.change(screen.getByLabelText('New relationship type description'), {
      target: { value: 'Strategic partnership' },
    });

    fireEvent.click(screen.getByRole('button', { name: /\+ Add/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PARTNERS_WITH',
          description: 'Strategic partnership',
        }),
      );
    });
  });

  test('row edit calls onUpdate', async () => {
    render(
      <RelationshipTypesPanel
        types={sampleTypes as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    fireEvent.change(screen.getByLabelText('Relationship type name'), {
      target: { value: 'SUPPORTS' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ name: 'SUPPORTS' }),
      );
    });
  });

  test('row delete calls onDelete', async () => {
    render(
      <RelationshipTypesPanel
        types={sampleTypes as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('r1');
    });
  });

  test('readOnly mode shows static row and no create form', () => {
    render(
      <RelationshipTypesPanel
        types={sampleTypes as any}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        readOnly={true}
      />,
    );

    expect(screen.queryByLabelText('New relationship type name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByText('FUNDS')).toBeInTheDocument();
  });
});
