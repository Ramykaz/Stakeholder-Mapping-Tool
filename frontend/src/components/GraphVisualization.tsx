import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { Core, Layouts } from 'cytoscape';
import { buildCytoscapeStylesheet } from '@/lib/cytoscapeStyle';
import { computeTwoHopNeighborhood, computeClusterPositions } from '@/lib/graphFocus';
import { getActiveTheme, Theme, DEFAULT_FILTER_STATE } from '@/lib/uiState';
import { CytoscapeNode, CytoscapeEdge } from '@/types';

interface GraphVisualizationProps {
  nodes: CytoscapeNode[];
  edges?: CytoscapeEdge[];
  onNodeClick?: (node: CytoscapeNode, options?: { shiftKey?: boolean }) => void;
  onBackgroundClick?: () => void;
  onFocusExit?: () => void;
  highlightNodeIds?: string[];
  /** External focus (e.g. from search). Ignored when internal focus mode is active. */
  focusNodeIds?: string[];
  centerNodeId?: string | null;
  command?: { type: 'zoomIn' | 'zoomOut' | 'fit' | 'reset'; nonce: number } | null;
  fontSize?: number;
  showControls?: boolean;
  height?: number;
  /** Show the collapsible filter + cluster panel */
  showFilterPanel?: boolean;
  /** Show the size legend overlay */
  showLegend?: boolean;
}

interface FocusMode {
  nodeId: string;
  hopRadius: 1 | 2;
}

function GraphVisualizationInner({
  nodes,
  edges = [],
  onNodeClick,
  onBackgroundClick,
  onFocusExit,
  highlightNodeIds = [],
  focusNodeIds = [],
  centerNodeId = null,
  command = null,
  fontSize = 11,
  showControls = false,
  height = 600,
  showFilterPanel = false,
  showLegend = false,
}: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutRef = useRef<Layouts | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const onFocusExitRef = useRef(onFocusExit);

  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { onBackgroundClickRef.current = onBackgroundClick; }, [onBackgroundClick]);
  useEffect(() => { onFocusExitRef.current = onFocusExit; }, [onFocusExit]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>(getActiveTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(getActiveTheme());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Apply theme to cy and container when theme changes
  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    const isDark = theme === 'dark';
    const bg = isDark ? '#080c14' : '#f0ece2';
    if (containerRef.current) containerRef.current.style.background = bg;
    cyRef.current.style(buildCytoscapeStylesheet(theme) as any);
    cyRef.current.style()
      .selector('node').style({ 'font-size': `${fontSize}px` })
      .selector('edge').style({ 'font-size': `${Math.max(7, fontSize - 2)}px` })
      .update();
  }, [theme, fontSize]);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterEntityTypes, setFilterEntityTypes] = useState<string[]>([]);
  const [filterConfMin, setFilterConfMin] = useState(0);
  const [filterDegMin, setFilterDegMin] = useState(0);
  const [clusterMode, setClusterMode] = useState<'none' | 'type'>('none');

  const allEntityTypes = useMemo(
    () => [...new Set(nodes.map(n => n.data.entity_type).filter(Boolean))].sort(),
    [nodes],
  );
  const maxDegree = useMemo(
    () => Math.max(1, ...nodes.map(n => n.data.degree ?? 0)),
    [nodes],
  );

  // ── Focus mode ────────────────────────────────────────────────────────────
  const [focusMode, setFocusMode] = useState<FocusMode | null>(null);
  const focusModeRef = useRef(focusMode);
  useEffect(() => { focusModeRef.current = focusMode; }, [focusMode]);

  const exitFocusMode = useCallback(() => {
    setFocusMode(null);
    onFocusExitRef.current?.();
  }, []);

  // Escape key exits focus mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusModeRef.current) exitFocusMode();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [exitFocusMode]);

  // ── Graph lifecycle ───────────────────────────────────────────────────────
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

  const runLayout = useCallback((cy: Core, opts: Record<string, unknown> = {}) => {
    if (!cy || cy.destroyed()) return;
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
        ...opts,
      } as any);
      layoutRef.current = layout;
      layout.run();
    } catch {
      try { cy.layout({ name: 'grid', padding: 40 }).run(); } catch { /* ignore */ }
    }
  }, []);

  const initGraph = useCallback(() => {
    if (!containerRef.current) return;
    destroyCy();

    const isDark = getActiveTheme() === 'dark';
    const bg = isDark ? '#080c14' : '#f0ece2';

    const nodeTypeMap = new Map(nodes.map(n => [n.id, n.data.entity_type || 'DEFAULT']));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map(node => ({
          data: {
            id: node.id,
            label: node.label,
            entity_type: node.data.entity_type,
            confidence: node.data.confidence,
            document_id: node.data.document_id,
            chunk_id: node.data.chunk_id,
            raw_mentions_count: node.data.raw_mentions_count,
            color: node.data.color || '#7b8299',
            degree: node.data.degree ?? node.degree ?? 0,
            node_size: node.data.node_size ?? 44,
          },
        })),
        ...(edges || []).map((edge, idx) => ({
          data: {
            id: edge.id || `edge-${idx}`,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            confidence: edge.confidence,
            edge_width: edge.edge_width || 1.5,
            sourceType: nodeTypeMap.get(edge.source) || 'DEFAULT',
          },
        })),
      ],
      style: buildCytoscapeStylesheet(isDark ? 'dark' : 'light') as any,
      layout: { name: 'preset' },
      minZoom: 0.3,
      maxZoom: 3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    } as any);

    if (containerRef.current) containerRef.current.style.background = bg;
    cyRef.current = cy;

    // Node click → onNodeClick + enter/switch focus mode
    cy.on('tap', 'node', (evt) => {
      const nodeData = evt.target.data();
      const shiftKey = Boolean((evt.originalEvent as any)?.shiftKey);
      const clickedNode: CytoscapeNode = {
        id: nodeData.id,
        label: nodeData.label,
        degree: nodeData.degree,
        style: { shape: 'ellipse', color: nodeData.color },
        data: {
          entity_id: nodeData.id,
          entity_type: nodeData.entity_type,
          confidence: nodeData.confidence,
          document_id: nodeData.document_id,
          chunk_id: nodeData.chunk_id,
          raw_mentions_count: nodeData.raw_mentions_count,
          shape: 'ellipse',
          color: nodeData.color,
          degree: nodeData.degree,
          node_size: nodeData.node_size,
        },
      };
      onNodeClickRef.current?.(clickedNode, { shiftKey });
      // Enter or keep focus mode
      setFocusMode(prev => ({
        nodeId: nodeData.id,
        hopRadius: prev?.hopRadius ?? 2,
      }));
    });

    // Background tap → exit focus mode + callback
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        onBackgroundClickRef.current?.();
        setFocusMode(null);
      }
    });

    // Hover dimming — suspended when focus mode is active
    cy.on('mouseover', 'node', (evt) => {
      if (focusModeRef.current) return;
      const node = evt.target;
      const neighbourhood = node.closedNeighborhood();
      cy.elements().not(neighbourhood).addClass('dimmed');
      neighbourhood.nodes().addClass('neighbour-node').removeClass('dimmed');
      neighbourhood.edges().addClass('neighbour-edge').removeClass('dimmed');
      if (tooltipRef.current) {
        tooltipRef.current.innerHTML = `
          <div style="font-size:14px;color:#e8eaf0;font-weight:500;margin-bottom:4px">${node.data('label') || ''}</div>
          <div style="font-size:11px;color:#5d6180;font-family:'DM Mono',monospace">${node.data('entity_type') || ''}</div>
        `;
        tooltipRef.current.style.display = 'block';
      }
    });

    cy.on('mousemove', 'node', (evt) => {
      if (!tooltipRef.current || !containerRef.current || focusModeRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (evt.originalEvent as MouseEvent).clientX - rect.left + 14;
      const y = (evt.originalEvent as MouseEvent).clientY - rect.top + 14;
      tooltipRef.current.style.left = `${x}px`;
      tooltipRef.current.style.top  = `${y}px`;
    });

    cy.on('mouseout', 'node', () => {
      if (focusModeRef.current) return;
      cy.elements().removeClass('dimmed neighbour-node neighbour-edge');
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    });

    requestAnimationFrame(() => {
      if (!cyRef.current || cyRef.current.destroyed()) return;
      runLayout(cy);
    });
  }, [nodes, edges, destroyCy, runLayout]);

  useEffect(() => {
    initGraph();
    return destroyCy;
  }, [initGraph, destroyCy]);

  // ── Font size ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    cyRef.current.style()
      .selector('node').style('font-size', `${fontSize}px`)
      .selector('edge').style('font-size', `${Math.max(7, fontSize - 2)}px`)
      .update();
  }, [fontSize]);

  // ── Search highlight ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    const cy = cyRef.current;
    cy.nodes().removeClass('search-hit');
    if (highlightNodeIds.length > 0) {
      highlightNodeIds.forEach(id => cy.getElementById(id).addClass('search-hit'));
    }
  }, [highlightNodeIds]);

  // ── Dimming: persistent focus mode takes priority over external focusNodeIds ──
  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    const cy = cyRef.current;
    cy.elements().removeClass('dimmed neighbour-node neighbour-edge focus-node');

    if (focusMode) {
      const neighborIds = computeTwoHopNeighborhood(focusMode.nodeId, nodes, edges, focusMode.hopRadius);
      const allowed = new Set(neighborIds);
      cy.nodes().forEach(node => {
        if (!allowed.has(node.id())) node.addClass('dimmed');
      });
      cy.edges().forEach(edge => {
        if (!allowed.has(edge.source().id()) || !allowed.has(edge.target().id())) edge.addClass('dimmed');
      });
      cy.getElementById(focusMode.nodeId).addClass('focus-node').removeClass('dimmed');
    } else if (focusNodeIds.length > 0) {
      const allowed = new Set(focusNodeIds);
      cy.nodes().forEach(node => { if (!allowed.has(node.id())) node.addClass('dimmed'); });
      cy.edges().forEach(edge => {
        if (!allowed.has(edge.source().id()) || !allowed.has(edge.target().id())) edge.addClass('dimmed');
      });
    }
  }, [focusMode, focusNodeIds, nodes, edges]);

  // ── Center node ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed() || !centerNodeId) return;
    const target = cyRef.current.getElementById(centerNodeId);
    if (target?.length > 0) {
      cyRef.current.animate(
        { center: { eles: target }, zoom: Math.min(2.2, Math.max(0.8, cyRef.current.zoom())) },
        { duration: 250 },
      );
    }
  }, [centerNodeId]);

  // ── Filters: show/hide cy elements ───────────────────────────────────────
  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    const cy = cyRef.current;

    (cy.elements() as any).show();

    if (filterEntityTypes.length > 0) {
      cy.nodes().forEach(node => {
        if (!filterEntityTypes.includes(node.data('entity_type'))) (node as any).hide();
      });
    }
    if (filterConfMin > 0) {
      cy.nodes().filter((n: any) => n.visible()).forEach(node => {
        if ((node.data('confidence') ?? 1) * 100 < filterConfMin) (node as any).hide();
      });
    }
    if (filterDegMin > 0) {
      cy.nodes().filter((n: any) => n.visible()).forEach(node => {
        if ((node.data('degree') ?? 0) < filterDegMin) (node as any).hide();
      });
    }
    // Hide edges where either endpoint is hidden
    cy.edges().forEach(edge => {
      if (!(edge.source() as any).visible() || !(edge.target() as any).visible()) (edge as any).hide();
    });
  }, [filterEntityTypes, filterConfMin, filterDegMin]);

  // ── Cluster layout ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    const cy = cyRef.current;

    if (clusterMode === 'type') {
      const w = containerRef.current?.clientWidth ?? 1200;
      const h = containerRef.current?.clientHeight ?? 800;
      const positions = computeClusterPositions(nodes, w, h);
      positions.forEach((pos, id) => {
        const el = cy.getElementById(id);
        if (el.length) el.position(pos);
      });
      runLayout(cy, { randomize: false, nodeRepulsion: () => 4000, idealEdgeLength: () => 80, gravity: 2 });
    } else {
      runLayout(cy);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterMode]);

  // ── External commands ─────────────────────────────────────────────────────
  const handleFitView    = useCallback(() => { cyRef.current?.fit(undefined, 40); }, []);
  const handleResetLayout = useCallback(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    if (layoutRef.current) { try { layoutRef.current.stop(); } catch { /* ignore */ } }
    runLayout(cyRef.current, { animationDuration: 500, nodeRepulsion: () => 8000, idealEdgeLength: () => 100, gravity: 0.25 });
  }, [runLayout]);

  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed() || !command) return;
    if (command.type === 'zoomIn')  { cyRef.current.zoom(Math.min(cyRef.current.maxZoom(), cyRef.current.zoom() + 0.2)); return; }
    if (command.type === 'zoomOut') { cyRef.current.zoom(Math.max(cyRef.current.minZoom(), cyRef.current.zoom() - 0.2)); return; }
    if (command.type === 'fit')     { handleFitView(); return; }
    if (command.type === 'reset')   { handleResetLayout(); }
  }, [command, handleFitView, handleResetLayout]);

  // ── UI helpers ────────────────────────────────────────────────────────────
  const isDark = theme === 'dark';
  const panelBg     = isDark ? '#1c1f2b' : '#ffffff';
  const panelBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';
  const textColor   = isDark ? '#e2e8f0' : '#1a1f2e';
  const text3Color  = isDark ? '#8892aa' : '#6b7280';

  // Tooltip div
  const tooltip = (
    <div
      ref={tooltipRef}
      style={{
        display: 'none', position: 'absolute', pointerEvents: 'none', zIndex: 50,
        background: panelBg, border: `1px solid ${panelBorder}`,
        borderRadius: 8, padding: '8px 12px',
        fontFamily: 'Figtree, Outfit, system-ui, sans-serif',
        maxWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    />
  );

  // Filter panel
  const filterPanel = showFilterPanel ? (
    <>
      {/* Filter toggle button */}
      <button
        onClick={() => setFilterPanelOpen(o => !o)}
        title="Filters &amp; Layout"
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          width: 32, height: 32, borderRadius: 8,
          background: filterPanelOpen ? 'var(--accent)' : panelBg,
          border: `1px solid ${panelBorder}`,
          color: filterPanelOpen ? '#fff' : textColor,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}
      >
        ⊟
      </button>

      {/* Filter panel */}
      {filterPanelOpen && (
        <div style={{
          position: 'absolute', top: 56, right: 16, zIndex: 10,
          width: 220, maxHeight: 'calc(100% - 80px)', overflowY: 'auto',
          background: panelBg, border: `1px solid ${panelBorder}`,
          borderRadius: 10, padding: '14px 14px 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Entity types */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: text3Color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Entity Types
            </div>
            {allEntityTypes.length === 0 ? (
              <div style={{ fontSize: 11, color: text3Color }}>No types available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: textColor, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filterEntityTypes.length === 0}
                    onChange={() => setFilterEntityTypes([])}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  All types
                </label>
                {allEntityTypes.map(type => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: textColor, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filterEntityTypes.includes(type)}
                      onChange={e => {
                        if (e.target.checked) {
                          setFilterEntityTypes(prev => [...prev, type]);
                        } else {
                          setFilterEntityTypes(prev => prev.filter(t => t !== type));
                        }
                      }}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    {type}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Confidence slider */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: text3Color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Min Confidence: {filterConfMin}%
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={filterConfMin}
              onChange={e => setFilterConfMin(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' } as any}
            />
          </div>

          {/* Degree slider */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: text3Color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Min Connections: {filterDegMin}
            </div>
            <input
              type="range" min={0} max={maxDegree} step={1}
              value={filterDegMin}
              onChange={e => setFilterDegMin(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' } as any}
            />
          </div>

          {/* Cluster layout */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: text3Color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Layout
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['none', 'type'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setClusterMode(mode)}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, border: `1px solid ${panelBorder}`,
                    background: clusterMode === mode ? 'var(--accent)' : 'transparent',
                    color: clusterMode === mode ? '#fff' : textColor,
                    fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)',
                  }}
                >
                  {mode === 'none' ? 'Default' : 'By Type'}
                </button>
              ))}
            </div>
          </div>

          {/* Reset filters */}
          {(filterEntityTypes.length > 0 || filterConfMin > 0 || filterDegMin > 0) && (
            <button
              onClick={() => { setFilterEntityTypes([]); setFilterConfMin(0); setFilterDegMin(0); }}
              style={{
                width: '100%', padding: '6px 0', borderRadius: 6,
                border: `1px solid ${panelBorder}`, background: 'transparent',
                color: text3Color, fontSize: 11, cursor: 'pointer',
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      )}
    </>
  ) : null;

  // Size legend
  const sizeLegend = showLegend ? (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 5,
      background: panelBg, border: `1px solid ${panelBorder}`,
      borderRadius: 8, padding: '8px 12px',
      display: 'flex', flexDirection: 'column', gap: 4,
      pointerEvents: 'none',
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: text3Color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
        Node size = connections
      </div>
      {[
        { label: 'Few (1–2)', size: 14 },
        { label: 'Moderate', size: 20 },
        { label: 'Many',     size: 28 },
      ].map(({ label, size }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${text3Color}`,
            background: isDark ? 'rgba(13,18,32,0.72)' : 'rgba(240,236,226,0.82)',
          }} />
          <span style={{ fontSize: 10, color: text3Color, fontFamily: 'var(--mono)' }}>{label}</span>
        </div>
      ))}
    </div>
  ) : null;

  // Persistent focus mode bar
  const focusBar = focusMode ? (() => {
    const focusedNode = nodes.find(n => n.id === focusMode.nodeId);
    return (
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', alignItems: 'center', gap: 8,
        background: panelBg, border: `1px solid ${panelBorder}`,
        borderRadius: 8, padding: '6px 10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <span style={{ fontSize: 11, color: text3Color, fontFamily: 'var(--mono)' }}>Focus:</span>
        <span style={{ fontSize: 12, color: textColor, fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {focusedNode?.label ?? focusMode.nodeId}
        </span>
        {/* Hop toggle */}
        {([1, 2] as const).map(hop => (
          <button
            key={hop}
            onClick={() => setFocusMode(prev => prev ? { ...prev, hopRadius: hop } : null)}
            title={`${hop}-hop neighbourhood`}
            style={{
              padding: '2px 8px', borderRadius: 4, border: `1px solid ${panelBorder}`,
              background: focusMode.hopRadius === hop ? 'var(--accent)' : 'transparent',
              color: focusMode.hopRadius === hop ? '#fff' : text3Color,
              fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)',
            }}
          >
            {hop}-hop
          </button>
        ))}
        <button
          onClick={exitFocusMode}
          title="Exit focus mode (Escape)"
          style={{
            padding: '2px 8px', borderRadius: 4, border: `1px solid ${panelBorder}`,
            background: 'transparent', color: text3Color,
            fontSize: 11, cursor: 'pointer',
          }}
        >
          ✕ Exit
        </button>
      </div>
    );
  })() : null;

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
            style={{ width: '100%', height, borderRadius: 8, background: isDark ? '#080c14' : '#f0ece2' }}
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
        style={{ width: '100%', height: '100%', background: isDark ? '#080c14' : '#f0ece2' }}
      />
      {tooltip}
      {filterPanel}
      {sizeLegend}
      {focusBar}
    </div>
  );
}

export default GraphVisualizationInner;
