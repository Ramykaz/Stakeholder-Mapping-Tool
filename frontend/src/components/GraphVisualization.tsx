import React, { useEffect, useRef, useCallback } from 'react';
import cytoscape, { Core, Layouts } from 'cytoscape';
import { cytoscapeStylesheet, ENTITY_COLORS } from '@/lib/cytoscapeStyle';
import { CytoscapeNode, CytoscapeEdge } from '@/types';

interface GraphVisualizationProps {
  nodes: CytoscapeNode[];
  edges?: CytoscapeEdge[];
  onNodeClick?: (node: CytoscapeNode, options?: { shiftKey?: boolean }) => void;
  onBackgroundClick?: () => void;
  highlightNodeIds?: string[];
  focusNodeIds?: string[];
  centerNodeId?: string | null;
  command?: { type: 'zoomIn' | 'zoomOut' | 'fit' | 'reset'; nonce: number } | null;
  fontSize?: number;
}

function GraphVisualizationInner({
  nodes,
  edges = [],
  onNodeClick,
  onBackgroundClick,
  highlightNodeIds = [],
  focusNodeIds = [],
  centerNodeId = null,
  command = null,
  fontSize = 11,
}: GraphVisualizationProps) {
  const LEGEND_DOT_CLASSES: Record<string, string> = {
    PERSON: 'bg-blue-100 border-blue-500',
    ORGANIZATION: 'bg-violet-100 border-violet-500',
    LOCATION: 'bg-emerald-100 border-emerald-500',
    ROLE: 'bg-amber-100 border-amber-500',
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutRef = useRef<Layouts | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);

  // Keep callback ref in sync without triggering re-init
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useEffect(() => {
    onBackgroundClickRef.current = onBackgroundClick;
  }, [onBackgroundClick]);

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
    const nodeElements = nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        entity_type: node.data.entity_type,
        confidence: node.data.confidence,
        document_id: node.data.document_id,
        chunk_id: node.data.chunk_id,
        raw_mentions_count: node.data.raw_mentions_count,
        shape: node.data.shape || 'ellipse',
        color: node.data.color || node.style?.color || '#9ca3af',
        degree: node.data.degree || node.degree || 0,
        node_size: node.data.node_size || 44,
      },
    }));

    // Convert API edges to Cytoscape elements
    const edgeElements = (edges || []).map((edge, idx) => ({
      data: {
        id: edge.id || `edge-${idx}`,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        confidence: edge.confidence,
        color: edge.color || '#9ca3af',
        edge_width: edge.edge_width || 2,
      },
    }));

    const elements = [...nodeElements, ...edgeElements];

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
      const shiftKey = Boolean((evt.originalEvent as any)?.shiftKey);
      const clickedNode: CytoscapeNode = {
        id: nodeData.id,
        label: nodeData.label,
        degree: nodeData.degree,
        style: {
          shape: nodeData.shape,
          color: nodeData.color,
        },
        data: {
          entity_id: nodeData.id,
          entity_type: nodeData.entity_type,
          confidence: nodeData.confidence,
          document_id: nodeData.document_id,
          chunk_id: nodeData.chunk_id,
          raw_mentions_count: nodeData.raw_mentions_count,
          shape: nodeData.shape,
          color: nodeData.color,
          degree: nodeData.degree,
          node_size: nodeData.node_size,
        },
      };
      onNodeClickRef.current(clickedNode, { shiftKey });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        onBackgroundClickRef.current?.();
      }
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
  }, [nodes, edges, destroyCy]);

  useEffect(() => {
    initGraph();
    return () => {
      destroyCy();
    };
  }, [initGraph, destroyCy]);

  // Live font size update — no graph reinit needed
  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    cyRef.current.style()
      .selector('node').style('font-size', `${fontSize}px`)
      .selector('edge').style('font-size', `${Math.max(7, fontSize - 2)}px`)
      .update();
  }, [fontSize]);

  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    const cy = cyRef.current;
    cy.nodes().removeClass('search-hit');
    if (highlightNodeIds.length > 0) {
      highlightNodeIds.forEach((id) => cy.getElementById(id).addClass('search-hit'));
    }
  }, [highlightNodeIds]);

  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    const cy = cyRef.current;
    cy.elements().removeClass('dimmed');
    if (focusNodeIds.length > 0) {
      const allowed = new Set(focusNodeIds);
      cy.nodes().forEach((node) => {
        if (!allowed.has(node.id())) {
          node.addClass('dimmed');
        }
      });
      cy.edges().forEach((edge) => {
        if (!allowed.has(edge.source().id()) || !allowed.has(edge.target().id())) {
          edge.addClass('dimmed');
        }
      });
    }
  }, [focusNodeIds]);

  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed() || !centerNodeId) return;
    const target = cyRef.current.getElementById(centerNodeId);
    if (target && target.length > 0) {
      cyRef.current.animate({
        center: { eles: target },
        zoom: Math.min(2.2, Math.max(0.8, cyRef.current.zoom())),
      }, {
        duration: 250,
      });
    }
  }, [centerNodeId]);

  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed() || !command) return;
    if (command.type === 'zoomIn') {
      cyRef.current.zoom(Math.min(cyRef.current.maxZoom(), cyRef.current.zoom() + 0.2));
      return;
    }
    if (command.type === 'zoomOut') {
      cyRef.current.zoom(Math.max(cyRef.current.minZoom(), cyRef.current.zoom() - 0.2));
      return;
    }
    if (command.type === 'fit') {
      handleFitView();
      return;
    }
    if (command.type === 'reset') {
      handleResetLayout();
    }
  }, [command]);

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
          {Object.entries(ENTITY_COLORS).map(([type]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full border ${LEGEND_DOT_CLASSES[type] || 'bg-gray-100 border-gray-400'}`}
              />
              <span className="text-gray-500 font-medium">{type}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFitView}
            className="btn-ghost text-xs !px-3 !py-1.5"
          >
            Fit View
          </button>
          <button
            onClick={handleResetLayout}
            className="btn-ghost text-xs !px-3 !py-1.5"
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
        className="cytoscape-container w-full h-[600px]"
      />

      {/* Node count */}
      <p className="text-xs text-gray-400 text-right font-medium tabular-nums">
        {nodes.length} node{nodes.length !== 1 ? 's' : ''} • {edges.length} edge{edges.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export default GraphVisualizationInner;
