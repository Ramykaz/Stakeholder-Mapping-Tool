import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('d3', () => {
  const makeTransform = (x = 0, y = 0, k = 1) => ({
    x,
    y,
    k,
    toString: () => '',
    translate: (tx: number, ty: number) => makeTransform(tx, ty, k),
    scale: (nextK: number) => makeTransform(x, y, nextK),
  });

  const selectObj: any = {
    call(fn: any, ...args: any[]) {
      if (typeof fn === 'function') fn(selectObj, ...args);
      return selectObj;
    },
    transition() { return selectObj; },
    duration() { return selectObj; },
    on() { return selectObj; },
    attr() { return selectObj; },
    style() { return selectObj; },
    selectAll() { return { call: () => undefined }; },
  };

  const zoomFn: any = () => undefined;
  zoomFn.scaleExtent = () => zoomFn;
  zoomFn.filter = () => zoomFn;
  zoomFn.on = () => zoomFn;
  zoomFn.transform = () => undefined;
  zoomFn.scaleBy = () => undefined;

  const dragFn: any = () => undefined;
  dragFn.on = () => dragFn;

  const forceLinkObj: any = {
    id: () => forceLinkObj,
    distance: () => forceLinkObj,
    strength: () => forceLinkObj,
  };

  const forceManyBodyObj: any = {
    strength: () => forceManyBodyObj,
  };

  const forceCollideObj: any = {
    radius: () => forceCollideObj,
    strength: () => forceCollideObj,
  };

  const forceXObj: any = {
    strength: () => forceXObj,
  };

  const forceYObj: any = {
    strength: () => forceYObj,
  };

  const forceSimulation = (nodes: any[]) => {
    const sim: any = {
      nodes: () => nodes,
      force: () => sim,
      alpha: () => sim,
      alphaDecay: () => sim,
      velocityDecay: () => sim,
      alphaTarget: () => sim,
      restart: () => sim,
      stop: () => sim,
      on: (event: string, callback: Function) => {
        if (event === 'tick' && typeof callback === 'function') callback();
        return sim;
      },
    };
    return sim;
  };

  return {
    select: () => selectObj,
    zoom: () => zoomFn,
    drag: () => dragFn,
    zoomIdentity: makeTransform(),
    forceSimulation,
    forceLink: () => forceLinkObj,
    forceManyBody: () => forceManyBodyObj,
    forceCollide: () => forceCollideObj,
    forceCenter: () => ({}),
    forceX: () => forceXObj,
    forceY: () => forceYObj,
  };
});

import GraphVisualization from '@/components/GraphVisualization';

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (global as any).ResizeObserver = ResizeObserverMock;
});

describe('GraphVisualization', () => {
  const nodes: any[] = [
    {
      id: 'n1',
      label: 'UNDP',
      degree: 1,
      data: {
        entity_id: 'n1',
        entity_type: 'ORGANIZATION',
        confidence: 0.95,
        document_id: 'doc-1',
        chunk_id: null,
        raw_mentions_count: 2,
        degree: 1,
        node_size: 50,
        color: '#3d6fff',
      },
    },
    {
      id: 'n2',
      label: 'WHO',
      degree: 1,
      data: {
        entity_id: 'n2',
        entity_type: 'ORGANIZATION',
        confidence: 0.9,
        document_id: 'doc-1',
        chunk_id: null,
        raw_mentions_count: 2,
        degree: 1,
        node_size: 46,
        color: '#2ec4a5',
      },
    },
  ];

  const edges: any[] = [
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      label: 'PARTNERS_WITH',
      confidence: 0.8,
      edge_width: 2,
    },
  ];

  test('renders with controls and shows node/edge counters', async () => {
    render(<GraphVisualization nodes={nodes as any} edges={edges as any} showControls={true} height={320} />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /Stakeholder entity graph visualization/i })).toBeInTheDocument();
      expect(screen.getByText(/2 nodes · 1 edge/i)).toBeInTheDocument();
    });
  });

  test('toggle isolated button changes label', async () => {
    render(<GraphVisualization nodes={nodes as any} edges={edges as any} />);

    const toggleBtn = await screen.findByRole('button', { name: /Show Isolated/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hide Isolated/i })).toBeInTheDocument();
    });
  });

  test('opens filter panel and updates confidence slider', async () => {
    render(
      <GraphVisualization
        nodes={nodes as any}
        edges={edges as any}
        showFilterPanel={true}
      />,
    );

    const filterToggle = await screen.findByRole('button', { name: '⊟' });
    fireEvent.click(filterToggle);

    const confSlider = await screen.findByLabelText('Minimum confidence');
    fireEvent.change(confSlider, { target: { value: '50' } });

    await waitFor(() => {
      expect(screen.getByText(/Min Confidence: 50%/i)).toBeInTheDocument();
    });
  });

  test('invokes callbacks for node and background clicks', async () => {
    const onNodeClick = jest.fn();
    const onBackgroundClick = jest.fn();

    const { container } = render(
      <GraphVisualization
        nodes={nodes as any}
        edges={edges as any}
        onNodeClick={onNodeClick}
        onBackgroundClick={onBackgroundClick}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-node-id="n1"]')).toBeTruthy();
    });

    fireEvent.click(container.querySelector('[data-node-id="n1"]') as Element);

    await waitFor(() => {
      expect(onNodeClick).toHaveBeenCalled();
      expect(screen.getByText(/Focus:/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('img', { name: /Stakeholder entity graph visualization/i }));
    expect(onBackgroundClick).toHaveBeenCalled();
  });
});
