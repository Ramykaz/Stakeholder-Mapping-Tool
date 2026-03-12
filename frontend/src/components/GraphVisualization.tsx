import React, { useEffect, useRef, useCallback } from 'react';
import cytoscape, { Core, Layouts } from 'cytoscape';
import { cytoscapeStylesheet, ENTITY_COLORS } from '@/lib/cytoscapeStyle';
import { CytoscapeNode } from '@/types';

interface GraphVisualizationProps {
  nodes: CytoscapeNode[];
  onNodeClick?: (node: CytoscapeNode) => void;
}

function GraphVisualizationInner({ nodes, onNodeClick }: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutRef = useRef<Layouts | null>(null);
  const onNodeClickRef = useRef(onNodeClick);

  // Keep callback ref in sync without triggering re-init
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  const destroyCy = useCallback(() => {
    // Stop any running layout before destroying
    if (layoutRef.current) {
      try { layoutRef.current.stop(); } catch { /* ignore */ }
      layoutRef.current = null;
    }
    if (cyRef.current) {
      try { cyRef.current.destroy(); } catch { /* ignore */ }
      cyRef.current = null;
    }
  }, []);

  const initGraph = useCallback(() => {
    if (!containerRef.current) return;

    // Destroy previous instance safely
    destroyCy();

    // Convert API nodes to Cytoscape elements
    const elements = nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        entity_type: node.data.entity_type,
        confidence: node.data.confidence,
        document_id: node.data.document_id,
        chunk_id: node.data.chunk_id,
        raw_mentions_count: node.data.raw_mentions_count,
      },
    }));

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: cytoscapeStylesheet,
      // Use preset layout initially (no animation), then run cose
      layout: { name: 'preset' },
      minZoom: 0.3,
      maxZoom: 3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cyRef.current = cy;

    // Node click handler (uses ref to avoid stale closure)
    cy.on('tap', 'node', (evt) => {
      if (!onNodeClickRef.current) return;
      const nodeData = evt.target.data();
      const clickedNode: CytoscapeNode = {
        id: nodeData.id,
        label: nodeData.label,
        data: {
          entity_id: nodeData.id,
          entity_type: nodeData.entity_type,
          confidence: nodeData.confidence,
          document_id: nodeData.document_id,
          chunk_id: nodeData.chunk_id,
          raw_mentions_count: nodeData.raw_mentions_count,
        },
      };
      onNodeClickRef.current(clickedNode);
    });

    // Run cose layout after a frame to ensure container has dimensions
    requestAnimationFrame(() => {
      if (!cyRef.current || cyRef.current.destroyed()) return;
      try {
        const layout = cy.layout({
          name: 'cose',
          animate: true,
          animationDuration: 500,
          nodeRepulsion: () => 8000,
          idealEdgeLength: () => 100,
          gravity: 0.25,
          padding: 40,
        } as any);
        layoutRef.current = layout;
        layout.run();
      } catch (e) {
        console.warn('Layout failed, using grid fallback:', e);
        try {
          cy.layout({ name: 'grid', padding: 40 }).run();
        } catch { /* ignore */ }
      }
    });
  }, [nodes, destroyCy]);

  useEffect(() => {
    initGraph();
    return () => {
      destroyCy();
    };
  }, [initGraph, destroyCy]);

  const handleFitView = () => {
    cyRef.current?.fit(undefined, 40);
  };

  const handleResetLayout = () => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    // Stop any running layout first
    if (layoutRef.current) {
      try { layoutRef.current.stop(); } catch { /* ignore */ }
    }
    try {
      const layout = cyRef.current.layout({
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 100,
        gravity: 0.25,
        padding: 40,
      } as any);
      layoutRef.current = layout;
      layout.run();
    } catch (e) {
      console.warn('Reset layout failed:', e);
    }
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          {Object.entries(ENTITY_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm border"
                style={{ backgroundColor: colors.bg, borderColor: colors.border }}
              />
              <span className="text-gray-600">{type}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFitView}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Fit View
          </button>
          <button
            onClick={handleResetLayout}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Reset Layout
          </button>
        </div>
      </div>

      {/* Graph container */}
      <div
        ref={containerRef}
        id="cytoscape-container"
        role="img"
        aria-label="Stakeholder entity graph visualization"
        style={{ width: '100%', height: '600px' }}
      />

      {/* Node count */}
      <p className="text-xs text-gray-500 text-right">
        {nodes.length} node{nodes.length !== 1 ? 's' : ''} displayed
      </p>
    </div>
  );
}

export default GraphVisualizationInner;
