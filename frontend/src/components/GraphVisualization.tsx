import React, { useEffect, useRef, useCallback } from 'react';
import cytoscape, { Core, Layouts } from 'cytoscape';
import { cytoscapeStylesheet } from '@/lib/cytoscapeStyle';
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
  /** If true, renders toolbar controls above and stats below the canvas */
  showControls?: boolean;
  /** Canvas height when showControls is true; defaults to 600 */
  height?: number;
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
  showControls = false,
  height = 600,
}: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutRef = useRef<Layouts | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);

  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { onBackgroundClickRef.current = onBackgroundClick; }, [onBackgroundClick]);

  const destroyCy = useCallback(() => {
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
    destroyCy();

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
        color: node.data.color || node.style?.color || '#7b8299',
        degree: node.data.degree || node.degree || 0,
        node_size: node.data.node_size || 44,
      },
    }));

    // Build a type lookup so edges can inherit source-node colour
    const nodeTypeMap = new Map(nodes.map(n => [n.id, n.data.entity_type || 'DEFAULT']));

    const edgeElements = (edges || []).map((edge, idx) => ({
      data: {
        id: edge.id || `edge-${idx}`,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        confidence: edge.confidence,
        color: edge.color || '#5a7dff',
        edge_width: edge.edge_width || 1.5,
        sourceType: nodeTypeMap.get(edge.source) || 'DEFAULT',
      },
    }));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodeElements, ...edgeElements],
      style: cytoscapeStylesheet,
      layout: { name: 'preset' },
      minZoom: 0.3,
      maxZoom: 3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      backgroundColor: '#080c14',
    } as any);

    cyRef.current = cy;

    cy.on('tap', 'node', (evt) => {
      if (!onNodeClickRef.current) return;
      const nodeData = evt.target.data();
      const shiftKey = Boolean((evt.originalEvent as any)?.shiftKey);
      const clickedNode: CytoscapeNode = {
        id: nodeData.id,
        label: nodeData.label,
        degree: nodeData.degree,
        style: { shape: nodeData.shape, color: nodeData.color },
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
      if (evt.target === cy) onBackgroundClickRef.current?.();
    });

    // ── Hover dimming + tooltip ──
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const neighbourhood = node.closedNeighborhood();

      cy.elements().not(neighbourhood).addClass('dimmed');
      cy.elements().not(neighbourhood).removeClass('neighbour-node neighbour-edge');

      neighbourhood.nodes().addClass('neighbour-node').removeClass('dimmed');
      neighbourhood.edges().addClass('neighbour-edge').removeClass('dimmed');

      if (tooltipRef.current) {
        const label = node.data('label') || '';
        const eType = node.data('entity_type') || '';
        tooltipRef.current.innerHTML = `
          <div style="font-size:14px;color:#e8eaf0;font-weight:500;margin-bottom:4px">${label}</div>
          <div style="font-size:11px;color:#5d6180;font-family:'DM Mono',monospace">${eType}</div>
        `;
        tooltipRef.current.style.display = 'block';
      }
    });

    cy.on('mousemove', 'node', (evt) => {
      if (!tooltipRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (evt.originalEvent as MouseEvent).clientX - rect.left + 14;
      const y = (evt.originalEvent as MouseEvent).clientY - rect.top + 14;
      tooltipRef.current.style.left = `${x}px`;
      tooltipRef.current.style.top  = `${y}px`;
    });

    cy.on('mouseout', 'node', () => {
      cy.elements().removeClass('dimmed neighbour-node neighbour-edge');
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    });

    requestAnimationFrame(() => {
      if (!cyRef.current || cyRef.current.destroyed()) return;
      try {
        const layout = cy.layout({
          name: 'cose',
          animate: true,
          animationDuration: 600,
          nodeRepulsion: () => 8000,
          idealEdgeLength: () => 120,
          edgeElasticity: () => 0.3,
          gravity: 1,
          numIter: 1000,
          padding: 40,
        } as any);
        layoutRef.current = layout;
        layout.run();
      } catch (e) {
        try { cy.layout({ name: 'grid', padding: 40 }).run(); } catch { /* ignore */ }
      }
    });
  }, [nodes, edges, destroyCy]);

  useEffect(() => {
    initGraph();
    return destroyCy;
  }, [initGraph, destroyCy]);

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
      cy.nodes().forEach((node) => { if (!allowed.has(node.id())) node.addClass('dimmed'); });
      cy.edges().forEach((edge) => {
        if (!allowed.has(edge.source().id()) || !allowed.has(edge.target().id())) edge.addClass('dimmed');
      });
    }
  }, [focusNodeIds]);

  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed() || !centerNodeId) return;
    const target = cyRef.current.getElementById(centerNodeId);
    if (target && target.length > 0) {
      cyRef.current.animate({ center: { eles: target }, zoom: Math.min(2.2, Math.max(0.8, cyRef.current.zoom())) }, { duration: 250 });
    }
  }, [centerNodeId]);

  const handleFitView = () => { cyRef.current?.fit(undefined, 40); };
  const handleResetLayout = () => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    if (layoutRef.current) { try { layoutRef.current.stop(); } catch { /* ignore */ } }
    try {
      const layout = cyRef.current.layout({
        name: 'cose', animate: true, animationDuration: 500,
        nodeRepulsion: () => 8000, idealEdgeLength: () => 100, gravity: 0.25, padding: 40,
      } as any);
      layoutRef.current = layout;
      layout.run();
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed() || !command) return;
    if (command.type === 'zoomIn') { cyRef.current.zoom(Math.min(cyRef.current.maxZoom(), cyRef.current.zoom() + 0.2)); return; }
    if (command.type === 'zoomOut') { cyRef.current.zoom(Math.max(cyRef.current.minZoom(), cyRef.current.zoom() - 0.2)); return; }
    if (command.type === 'fit') { handleFitView(); return; }
    if (command.type === 'reset') { handleResetLayout(); }
  }, [command]);

  const tooltip = (
    <div
      ref={tooltipRef}
      style={{
        display: 'none',
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 50,
        background: '#1c1f2b',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: 'Figtree, Outfit, system-ui, sans-serif',
        maxWidth: 200,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    />
  );

  if (showControls) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={handleFitView} className="btn-ghost" style={{ fontSize: 11 }}>Fit View</button>
          <button onClick={handleResetLayout} className="btn-ghost" style={{ fontSize: 11 }}>Reset Layout</button>
        </div>
        <div style={{ position: 'relative' }}>
          <div
            ref={containerRef}
            id="cytoscape-container"
            role="img"
            aria-label="Stakeholder entity graph visualization"
            style={{ width: '100%', height, borderRadius: 8, background: '#080c14' }}
          />
          {tooltip}
        </div>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
          {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {edges.length} edge{edges.length !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        id="cytoscape-container"
        role="img"
        aria-label="Stakeholder entity graph visualization"
        style={{ width: '100%', height: '100%', background: '#080c14' }}
      />
      {tooltip}
    </div>
  );
}

export default GraphVisualizationInner;
