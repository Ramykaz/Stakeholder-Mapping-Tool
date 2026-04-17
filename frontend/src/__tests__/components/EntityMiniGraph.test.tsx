/**
 * Unit tests for src/components/EntityMiniGraph.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EntityMiniGraph from '@/components/EntityMiniGraph';
import type { MiniNode, MiniEdge } from '@/lib/entityNeighborhood';

const centerNode: MiniNode = {
  id: 'n0',
  label: 'UNDP',
  entityType: 'ORGANIZATION',
  x: 200,
  y: 160,
  isCenter: true,
};

const neighborNode: MiniNode = {
  id: 'n1',
  label: 'World Bank',
  entityType: 'ORGANIZATION',
  x: 100,
  y: 80,
  isCenter: false,
};

const edge: MiniEdge = {
  id: 'e0',
  sourceId: 'n0',
  targetId: 'n1',
  label: 'partners with',
  isBidirectional: false,
  directionText: 'UNDP → World Bank',
};

const biEdge: MiniEdge = {
  ...edge,
  id: 'e1',
  isBidirectional: true,
  directionText: 'UNDP ↔ World Bank',
};

describe('EntityMiniGraph', () => {
  test('renders empty state when fewer than 2 nodes provided', () => {
    render(
      <EntityMiniGraph nodes={[centerNode]} edges={[]} onNodeClick={jest.fn()} />,
    );
    expect(
      screen.getByText(/No connections extracted from documents yet/i),
    ).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeNull();
  });

  test('renders empty state when nodes array is empty', () => {
    render(<EntityMiniGraph nodes={[]} edges={[]} onNodeClick={jest.fn()} />);
    expect(
      screen.getByText(/No connections extracted from documents yet/i),
    ).toBeInTheDocument();
  });

  test('renders SVG when 2 or more nodes present', () => {
    render(
      <EntityMiniGraph
        nodes={[centerNode, neighborNode]}
        edges={[edge]}
        onNodeClick={jest.fn()}
      />,
    );
    expect(document.querySelector('svg')).toBeInTheDocument();
    expect(document.querySelector('svg')!.getAttribute('aria-label')).toBe(
      'Entity neighborhood mini graph',
    );
  });

  test('renders node labels as SVG text elements', () => {
    render(
      <EntityMiniGraph
        nodes={[centerNode, neighborNode]}
        edges={[edge]}
        onNodeClick={jest.fn()}
      />,
    );
    expect(screen.getByText('UNDP')).toBeInTheDocument();
    expect(screen.getByText('World Bank')).toBeInTheDocument();
  });

  test('truncates labels longer than 22 characters', () => {
    const longNode: MiniNode = {
      ...neighborNode,
      id: 'n2',
      label: 'United Nations Development Programme',
    };
    render(
      <EntityMiniGraph
        nodes={[centerNode, longNode]}
        edges={[]}
        onNodeClick={jest.fn()}
      />,
    );
    expect(screen.getByText('United Nations Develop…')).toBeInTheDocument();
  });

  test('calls onNodeClick with node id when non-center node is clicked', () => {
    const handleClick = jest.fn();
    render(
      <EntityMiniGraph
        nodes={[centerNode, neighborNode]}
        edges={[edge]}
        onNodeClick={handleClick}
      />,
    );
    const circles = document.querySelectorAll('circle');
    // Find the non-center circle (smaller radius = 18)
    const neighborCircle = Array.from(circles).find(
      (c) => c.getAttribute('r') === '18',
    );
    expect(neighborCircle).toBeTruthy();
    fireEvent.click(neighborCircle!.parentElement!);
    expect(handleClick).toHaveBeenCalledWith('n1');
  });

  test('does NOT call onNodeClick when center node is clicked', () => {
    const handleClick = jest.fn();
    render(
      <EntityMiniGraph
        nodes={[centerNode, neighborNode]}
        edges={[edge]}
        onNodeClick={handleClick}
      />,
    );
    const circles = document.querySelectorAll('circle');
    const centerCircle = Array.from(circles).find(
      (c) => c.getAttribute('r') === '24',
    );
    expect(centerCircle).toBeTruthy();
    fireEvent.click(centerCircle!.parentElement!);
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('renders edge label text in SVG', () => {
    render(
      <EntityMiniGraph
        nodes={[centerNode, neighborNode]}
        edges={[edge]}
        onNodeClick={jest.fn()}
      />,
    );
    expect(screen.getByText('partners with')).toBeInTheDocument();
  });

  test('renders connection summary list', () => {
    render(
      <EntityMiniGraph
        nodes={[centerNode, neighborNode]}
        edges={[edge]}
        onNodeClick={jest.fn()}
      />,
    );
    expect(screen.getByText(/UNDP → World Bank/)).toBeInTheDocument();
    expect(screen.getByText(/one-way/)).toBeInTheDocument();
  });

  test('bidirectional edge shows two-way in summary', () => {
    render(
      <EntityMiniGraph
        nodes={[centerNode, neighborNode]}
        edges={[biEdge]}
        onNodeClick={jest.fn()}
      />,
    );
    expect(screen.getByText(/two-way/)).toBeInTheDocument();
  });

  test('renders connection guide text', () => {
    render(
      <EntityMiniGraph
        nodes={[centerNode, neighborNode]}
        edges={[edge]}
        onNodeClick={jest.fn()}
      />,
    );
    expect(screen.getByText(/Connection guide/i)).toBeInTheDocument();
  });
});
