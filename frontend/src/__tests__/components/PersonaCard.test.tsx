/**
 * Unit tests for src/components/PersonaCard.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PersonaCard, { PersonaCardSkeleton } from '@/components/PersonaCard';

const basePersona = {
  id: 'persona-1',
  entity_type_label: 'Organization',
  persona_name: 'The Advocate',
  archetype_label: 'Champion of Change',
  demographics: 'Urban professionals aged 30–50',
  motivations: ['Improve policy', 'Build coalitions', 'Increase funding'],
  frustrations: ['Slow bureaucracy', 'Lack of data', 'Resource gaps'],
  representative_entities: [],
};

describe('PersonaCard', () => {
  test('renders persona name', () => {
    render(<PersonaCard persona={basePersona as any} onEntityClick={jest.fn()} />);
    expect(screen.getByText('The Advocate')).toBeInTheDocument();
  });

  test('renders archetype label', () => {
    render(<PersonaCard persona={basePersona as any} onEntityClick={jest.fn()} />);
    expect(screen.getByText('Champion of Change')).toBeInTheDocument();
  });

  test('renders entity type badge', () => {
    render(<PersonaCard persona={basePersona as any} onEntityClick={jest.fn()} />);
    expect(screen.getByText('Organization')).toBeInTheDocument();
  });

  test('renders demographics text', () => {
    render(<PersonaCard persona={basePersona as any} onEntityClick={jest.fn()} />);
    expect(screen.getByText('Urban professionals aged 30–50')).toBeInTheDocument();
  });

  test('renders all motivations', () => {
    render(<PersonaCard persona={basePersona as any} onEntityClick={jest.fn()} />);
    expect(screen.getByText('Improve policy')).toBeInTheDocument();
    expect(screen.getByText('Build coalitions')).toBeInTheDocument();
    expect(screen.getByText('Increase funding')).toBeInTheDocument();
  });

  test('renders all frustrations', () => {
    render(<PersonaCard persona={basePersona as any} onEntityClick={jest.fn()} />);
    expect(screen.getByText('Slow bureaucracy')).toBeInTheDocument();
    expect(screen.getByText('Lack of data')).toBeInTheDocument();
  });

  test('does not render "Based on" section when representative_entities is empty', () => {
    render(<PersonaCard persona={basePersona as any} onEntityClick={jest.fn()} />);
    expect(screen.queryByText(/based on/i)).not.toBeInTheDocument();
  });

  test('renders representative entity buttons and calls onEntityClick', () => {
    const persona = {
      ...basePersona,
      representative_entities: [{ id: 'ent-1', name: 'UNDP Geneva' }],
    };
    const onEntityClick = jest.fn();
    render(<PersonaCard persona={persona as any} onEntityClick={onEntityClick} />);
    const btn = screen.getByText('UNDP Geneva');
    fireEvent.click(btn);
    expect(onEntityClick).toHaveBeenCalledWith('ent-1');
  });

  test('uses default teal color when entityTypeColor not provided', () => {
    render(
      <PersonaCard persona={basePersona as any} onEntityClick={jest.fn()} />,
    );
    const badge = screen.getByText('Organization');
    expect(badge).toHaveStyle({ color: 'var(--teal)' });
  });

  test('uses custom entityTypeColor when provided', () => {
    render(
      <PersonaCard persona={basePersona as any} onEntityClick={jest.fn()} entityTypeColor="#ff0000" />,
    );
    const badge = screen.getByText('Organization');
    expect(badge).toHaveStyle({ color: '#ff0000' });
  });
});

describe('PersonaCardSkeleton', () => {
  test('renders without crashing', () => {
    const { container } = render(<PersonaCardSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('has animate-pulse class', () => {
    const { container } = render(<PersonaCardSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
