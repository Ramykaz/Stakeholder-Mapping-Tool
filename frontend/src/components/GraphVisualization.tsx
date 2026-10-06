import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TYPE_PALETTE } from '@/lib/cytoscapeStyle';
import { computeTwoHopNeighborhood, computeClusterPositions } from '@/lib/graphFocus';
import { getActiveTheme, Theme } from '@/lib/uiState';
import { CytoscapeNode, CytoscapeEdge } from '@/types';

/**
 * GraphVisualization contract inventory (US2 T023)
 *
 * Input props contract:
 * - `nodes` (required): canonical node list; each node id must be stable and unique.
 * - `edges` (optional): relationship list keyed by source/target node ids.
 * - `onNodeClick`: fired on node tap/click with reconstructed `CytoscapeNode` and `{ shiftKey }`.
 * - `onBackgroundClick`: fired when graph background is clicked.
 * - `onFocusExit`: fired when persistent focus mode exits (escape or explicit exit).
 * - `highlightNodeIds`: external search highlighting ids.
 * - `focusNodeIds`: external dimming focus ids, used only when internal focus mode is not active.
 * - `centerNodeId`: optional node to center/zoom to after render.
 * - `command`: imperative action channel using `{ type, nonce }` where type ∈
 *   `zoomIn | zoomOut | fit | reset | png`.
 * - `fontSize`, `showControls`, `height`, `showFilterPanel`, `showLegend`: presentation controls.
 *
 * Interaction contract:
 * - Node click always enters/updates internal focus mode (default 2-hop) and keeps callback parity.
 * - Background click clears internal focus mode and preserves callback parity.
 * - Hover neighborhood dimming is disabled while internal focus mode is active.
 * - Escape key exits internal focus mode.
 *
 * Rendering/layout contract:
 * - D3 force simulation provides core rendering/layout.
 * - Initial render uses deterministic seeded positions before simulation settles.
 * - Theme and font-size updates are reactive after mount.
 * - ResizeObserver keeps viewport and force center aligned with container size.
 */
interface GraphVisualizationProps {
  nodes: CytoscapeNode[];
  edges?: CytoscapeEdge[];
  onNodeClick?: (node: CytoscapeNode, options?: { shiftKey?: boolean }) => void;
  onBackgroundClick?: () => void;
  onFocusExit?: () => void;
  highlightNodeIds?: string[];
  focusNodeIds?: string[];
  centerNodeId?: string | null;
  command?: { type: 'zoomIn' | 'zoomOut' | 'fit' | 'reset' | 'png'; nonce: number } | null;
  fontSize?: number;
  showControls?: boolean;
  height?: number;
  showFilterPanel?: boolean;
  showLegend?: boolean;
}

interface FocusMode {
  nodeId: string;
  hopRadius: 1 | 2;
}

interface SimNode {
  id: string;
  label: string;
  entity_type?: string;
  confidence?: number;
  document_id?: string;
  chunk_id?: string | null;
  raw_mentions_count?: number;
  color: string;
  degree: number;
  node_size: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimEdge {
  id: string;
  source: string | SimNode;
  target: string | SimNode;
  label?: string;
  confidence?: number;
  edge_width: number;
  sourceType: string;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportGroupRef = useRef<SVGGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const onNodeClickRef = useRef(onNodeClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const onFocusExitRef = useRef(onFocusExit);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { onBackgroundClickRef.current = onBackgroundClick; }, [onBackgroundClick]);
  useEffect(() => { onFocusExitRef.current = onFocusExit; }, [onFocusExit]);

  const [theme, setTheme] = useState<Theme>(getActiveTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getActiveTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterEntityTypes, setFilterEntityTypes] = useState<string[]>([]);
  const [filterConfMin, setFilterConfMin] = useState(0);
  const [filterDegMin, setFilterDegMin] = useState(0);
  const [hideIsolatedNodes, setHideIsolatedNodes] = useState(true);
  const [clusterMode, setClusterMode] = useState<'none' | 'type'>('none');

  const allEntityTypes = useMemo(
    () => [...new Set(nodes.map(n => n.data.entity_type).filter(Boolean))].sort(),
    [nodes],
  );
  const maxDegree = useMemo(
    () => Math.max(1, ...nodes.map(n => n.data.degree ?? n.degree ?? 0)),
    [nodes],
  );

  const [focusMode, setFocusMode] = useState<FocusMode | null>(null);
  const focusModeRef = useRef(focusMode);
  useEffect(() => { focusModeRef.current = focusMode; }, [focusMode]);

  const exitFocusMode = useCallback(() => {
    setFocusMode(null);
    onFocusExitRef.current?.();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusModeRef.current) exitFocusMode();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [exitFocusMode]);

  const [viewportSize, setViewportSize] = useState({ width: 1200, height: Math.max(360, height) });
  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (!containerRef.current) return;
      const width = Math.max(320, containerRef.current.clientWidth || 1200);
      const h = showControls ? height : Math.max(360, containerRef.current.clientHeight || height || 600);
      setViewportSize({ width, height: h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    roRef.current = ro;
    return () => {
      if (roRef.current) roRef.current.disconnect();
      roRef.current = null;
    };
  }, [height, showControls]);

  const baseVisibleNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (filterEntityTypes.length > 0 && !filterEntityTypes.includes(node.data.entity_type)) return false;
      if (filterConfMin > 0 && ((node.data.confidence ?? 1) * 100 < filterConfMin)) return false;
      if (filterDegMin > 0 && ((node.data.degree ?? node.degree ?? 0) < filterDegMin)) return false;
      return true;
    });
  }, [nodes, filterEntityTypes, filterConfMin, filterDegMin]);

  const baseVisibleNodeIdSet = useMemo(() => new Set(baseVisibleNodes.map(n => n.id)), [baseVisibleNodes]);

  const baseVisibleEdges = useMemo(() => {
    return (edges || []).filter(edge => baseVisibleNodeIdSet.has(edge.source) && baseVisibleNodeIdSet.has(edge.target));
  }, [edges, baseVisibleNodeIdSet]);

  const baseDegreeMap = useMemo(() => {
    const degreeMap = new Map<string, number>();
    baseVisibleNodes.forEach((node) => degreeMap.set(node.id, 0));
    baseVisibleEdges.forEach((edge) => {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    });
    return degreeMap;
  }, [baseVisibleNodes, baseVisibleEdges]);

  const isolatedNodeIds = useMemo(() => {
    const isolated = new Set<string>();
    baseDegreeMap.forEach((degree, nodeId) => {
      if (degree === 0) isolated.add(nodeId);
    });
    return isolated;
  }, [baseDegreeMap]);

  const visibleNodes = useMemo(() => {
    if (!hideIsolatedNodes) return baseVisibleNodes;
    return baseVisibleNodes.filter((node) => !isolatedNodeIds.has(node.id));
  }, [hideIsolatedNodes, baseVisibleNodes, isolatedNodeIds]);

  const visibleNodeIdSet = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return baseVisibleEdges.filter(edge => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target));
  }, [baseVisibleEdges, visibleNodeIdSet]);

  const seededNodes = useMemo<SimNode[]>(() => {
    const width = viewportSize.width;
    const h = viewportSize.height;
    const cx = width / 2;
    const cy = h / 2;
    const sorted = [...visibleNodes].sort((a, b) => (b.data.degree ?? b.degree ?? 0) - (a.data.degree ?? a.degree ?? 0));
    const ringStep = 90;

    return sorted.map((node, index) => {
      const ring = Math.floor(index / 10);
      const ringCount = Math.min(10, Math.max(1, sorted.length - ring * 10));
      const angle = ((index % 10) / ringCount) * Math.PI * 2;
      const radius = 60 + ring * ringStep;
      return {
        id: node.id,
        label: node.label,
        entity_type: node.data.entity_type,
        confidence: node.data.confidence,
        document_id: node.data.document_id,
        chunk_id: node.data.chunk_id,
        raw_mentions_count: node.data.raw_mentions_count,
        color: node.data.color || '#8a97a6',
        degree: node.data.degree ?? node.degree ?? 0,
        node_size: node.data.node_size ?? 44,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });
  }, [visibleNodes, viewportSize.width, viewportSize.height]);

  const seededEdges = useMemo<SimEdge[]>(() => {
    const nodeTypeMap = new Map(visibleNodes.map(n => [n.id, n.data.entity_type || 'DEFAULT']));
    return visibleEdges.map((edge, idx) => ({
      id: edge.id || `edge-${idx}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      confidence: edge.confidence,
      edge_width: edge.edge_width || 1.5,
      sourceType: nodeTypeMap.get(edge.source) || 'DEFAULT',
    }));
  }, [visibleEdges, visibleNodes]);

  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);
  const simulationRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);
  const draggingNodeIdRef = useRef<string | null>(null);

  const destroySimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
  }, []);

  const restartSimulation = useCallback((targetNodes: SimNode[], targetEdges: SimEdge[], reheat = 0.7) => {
    destroySimulation();
    if (targetNodes.length === 0) {
      setSimNodes([]);
      setSimEdges([]);
      return;
    }

    const simNodeClones = targetNodes.map(n => ({ ...n }));
    const simEdgeClones = targetEdges.map(e => ({ ...e }));

    if (clusterMode === 'type') {
      const positions = computeClusterPositions(
        visibleNodes,
        viewportSize.width,
        viewportSize.height,
      );
      simNodeClones.forEach((node) => {
        const pos = positions.get(node.id);
        if (pos) {
          node.fx = pos.x;
          node.fy = pos.y;
        }
      });
    } else {
      simNodeClones.forEach((node) => {
        node.fx = null;
        node.fy = null;
      });
    }

    const simulation = d3.forceSimulation<SimNode>(simNodeClones)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdgeClones).id((d: any) => d.id).distance(190).strength(0.22))
      .force('charge', d3.forceManyBody().strength(-1400))
      .force('collide', d3.forceCollide<SimNode>().radius(d => Math.max(24, (d.node_size || 44) * 0.55) + 26).iterations(3))
      .force('center', d3.forceCenter(viewportSize.width / 2, viewportSize.height / 2))
      .force('x', d3.forceX(viewportSize.width / 2).strength(0.035))
      .force('y', d3.forceY(viewportSize.height / 2).strength(0.035))
      .alpha(0.9)
      .alphaDecay(0.018)
      .velocityDecay(0.35);

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      setSimNodes([...simNodeClones]);
      setSimEdges([...simEdgeClones]);
    });

    simulation.alpha(reheat).restart();
    setSimNodes([...simNodeClones]);
    setSimEdges([...simEdgeClones]);
  }, [destroySimulation, clusterMode, visibleNodes, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    restartSimulation(seededNodes, seededEdges, 0.75);
    return destroySimulation;
  }, [seededNodes, seededEdges, restartSimulation, destroySimulation]);

  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomTransform, setZoomTransform] = useState(d3.zoomIdentity);

  useEffect(() => {
    if (!svgRef.current || !viewportGroupRef.current) return;

    const svg = d3.select(svgRef.current);
    const viewport = d3.select(viewportGroupRef.current);

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3.5])
      .filter((event: any) => {
        if (draggingNodeIdRef.current) return false;
        if (event?.type === 'wheel') return true;
        const target = event?.target as HTMLElement | null;
        if (target?.closest?.('[data-node-id]')) return false;
        return true;
      })
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
        setZoomTransform(event.transform);
      });

    svg.call(zoomBehavior as any);
    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      svg.on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!viewportGroupRef.current || !simulationRef.current) return;

    const dragBehavior = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, datum) => {
        event.sourceEvent?.stopPropagation?.();
        draggingNodeIdRef.current = datum.id;
        if (!event.active) simulationRef.current?.alphaTarget(0.2).restart();
        datum.fx = datum.x;
        datum.fy = datum.y;
      })
      .on('drag', (event, datum) => {
        datum.fx = event.x;
        datum.fy = event.y;
        setSimNodes((prev) => prev.map((node) => (
          node.id === datum.id ? { ...node, x: event.x, y: event.y, fx: event.x, fy: event.y } : node
        )));
      })
      .on('end', (event, datum) => {
        draggingNodeIdRef.current = null;
        if (!event.active) simulationRef.current?.alphaTarget(0);
        datum.fx = datum.x;
        datum.fy = datum.y;
      });

    // The <g class="graph-node"> elements are rendered by React, not by a D3
    // data-join, so they have no bound __data__ by default — d3-drag's handlers
    // would receive `undefined` as the datum and throw on `datum.fx = ...`,
    // which silently aborted every drag before it could move anything. Bind
    // each element's current SimNode explicitly before attaching the behavior.
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));
    d3.select(viewportGroupRef.current)
      .selectAll<SVGGElement, SimNode>('g.graph-node')
      .each(function bindDatum() {
        const id = this.getAttribute('data-node-id');
        const datum = id ? nodeById.get(id) : undefined;
        if (datum) d3.select(this).datum(datum);
      })
      .call(dragBehavior as any);
  }, [simNodes]);

  const fitView = useCallback((duration = 250) => {
    if (!svgRef.current || !zoomBehaviorRef.current || simNodes.length === 0) return;

    const xValues = simNodes.map(n => n.x);
    const yValues = simNodes.map(n => n.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const graphWidth = Math.max(1, maxX - minX);
    const graphHeight = Math.max(1, maxY - minY);
    const padding = 80;

    const scale = Math.min(
      3.5,
      Math.max(0.55, Math.min(
        (viewportSize.width - padding) / graphWidth,
        (viewportSize.height - padding) / graphHeight,
      )),
    );

    const tx = viewportSize.width / 2 - ((minX + maxX) / 2) * scale;
    const ty = viewportSize.height / 2 - ((minY + maxY) / 2) * scale;
    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

    d3.select(svgRef.current)
      .transition()
      .duration(duration)
      .call(zoomBehaviorRef.current.transform as any, transform);
  }, [simNodes, viewportSize.width, viewportSize.height]);

  const resetLayout = useCallback(() => {
    restartSimulation(seededNodes, seededEdges, 1);
  }, [restartSimulation, seededNodes, seededEdges]);

  useEffect(() => {
    if (!command || !svgRef.current || !zoomBehaviorRef.current) return;

    const svg = d3.select(svgRef.current);
    if (command.type === 'zoomIn') {
      svg.transition().duration(180).call(zoomBehaviorRef.current.scaleBy as any, 1.2);
      return;
    }
    if (command.type === 'zoomOut') {
      svg.transition().duration(180).call(zoomBehaviorRef.current.scaleBy as any, 1 / 1.2);
      return;
    }
    if (command.type === 'fit') {
      fitView();
      return;
    }
    if (command.type === 'reset') {
      resetLayout();
      fitView(320);
      return;
    }
    if (command.type === 'png' && svgRef.current) {
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svgRef.current);
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, viewportSize.width * 2);
        canvas.height = Math.max(1, viewportSize.height * 2);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = theme === 'dark' ? '#0c1819' : '#efe9d8';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUri = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUri;
          a.download = 'stakeholder-graph.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  }, [command, fitView, resetLayout, theme, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    if (simNodes.length > 0) {
      fitView(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes.length]);

  const nodeById = useMemo(() => new Map(simNodes.map(n => [n.id, n])), [simNodes]);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null);

  const focusAllowedIds = useMemo(() => {
    if (focusMode) {
      return new Set(computeTwoHopNeighborhood(focusMode.nodeId, nodes, edges, focusMode.hopRadius));
    }
    if (focusNodeIds.length > 0) {
      return new Set(focusNodeIds);
    }
    return null;
  }, [focusMode, focusNodeIds, nodes, edges]);

  const hoverNeighborIds = useMemo(() => {
    if (!hoverNodeId || focusMode) return null;
    const connected = new Set<string>([hoverNodeId]);
    (edges || []).forEach((edge) => {
      if (edge.source === hoverNodeId) connected.add(edge.target);
      if (edge.target === hoverNodeId) connected.add(edge.source);
    });
    return connected;
  }, [hoverNodeId, edges, focusMode]);

  const isNodeDimmed = useCallback((nodeId: string) => {
    if (focusAllowedIds) return !focusAllowedIds.has(nodeId);
    if (hoverNeighborIds) return !hoverNeighborIds.has(nodeId);
    return false;
  }, [focusAllowedIds, hoverNeighborIds]);

  const isEdgeDimmed = useCallback((edge: SimEdge) => {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
    if (focusAllowedIds) return !focusAllowedIds.has(sourceId) || !focusAllowedIds.has(targetId);
    if (hoverNeighborIds) return !hoverNeighborIds.has(sourceId) || !hoverNeighborIds.has(targetId);
    return false;
  }, [focusAllowedIds, hoverNeighborIds]);

  const handleNodeClick = useCallback((node: SimNode, e: React.MouseEvent<SVGGElement>) => {
    const clickedNode: CytoscapeNode = {
      id: node.id,
      label: node.label,
      degree: node.degree,
      style: { shape: 'ellipse', color: node.color },
      data: {
        entity_id: node.id,
        entity_type: (node.entity_type as any) || 'PERSON',
        confidence: node.confidence ?? 0,
        document_id: node.document_id || '',
        chunk_id: node.chunk_id ?? null,
        raw_mentions_count: node.raw_mentions_count ?? 0,
        shape: 'ellipse',
        color: node.color,
        degree: node.degree,
        node_size: node.node_size,
      },
    };
    onNodeClickRef.current?.(clickedNode, { shiftKey: e.shiftKey });
    setFocusMode(prev => ({ nodeId: node.id, hopRadius: prev?.hopRadius ?? 2 }));
  }, []);

  const updateTooltipPosition = useCallback((event: React.MouseEvent) => {
    if (!tooltipRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left + 14;
    const y = event.clientY - rect.top + 14;
    tooltipRef.current.style.left = `${x}px`;
    tooltipRef.current.style.top = `${y}px`;
  }, []);

  const showNodeTooltip = useCallback((node: SimNode) => {
    if (!tooltipRef.current) return;
    const titleColor = theme === 'dark' ? '#eef1ea' : '#1f2e28';
    const metaColor = theme === 'dark' ? '#a9bdb6' : '#4d5f54';
    tooltipRef.current.innerHTML = `
      <div style="font-size:14px;color:${titleColor};font-weight:500;margin-bottom:4px">${node.label || ''}</div>
      <div style="font-size:11px;color:${metaColor};font-family:var(--mono)">${node.entity_type || ''}</div>
    `;
    tooltipRef.current.style.display = 'block';
  }, [theme]);

  const showEdgeTooltip = useCallback((edge: SimEdge) => {
    if (!tooltipRef.current) return;
    const titleColor = theme === 'dark' ? '#eef1ea' : '#1f2e28';
    const metaColor = theme === 'dark' ? '#a9bdb6' : '#4d5f54';
    const relationLabel = (edge.label || 'relates to').replace(/_/g, ' ');
    const relationMeaning = (() => {
      const key = relationLabel.toLowerCase();
      if (key.includes('influenc')) return 'Influence or power relationship between stakeholders.';
      if (key.includes('fund')) return 'Funding or resource support relationship.';
      if (key.includes('partner') || key.includes('collaborat')) return 'Collaboration or partnership link.';
      if (key.includes('report') || key.includes('communicat')) return 'Information flow or reporting relationship.';
      if (key.includes('conflict') || key.includes('oppose')) return 'Potential tension or opposing interests.';
      return 'Detected relationship between these two entities.';
    })();
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
    const src = nodeById.get(sourceId)?.label || sourceId;
    const tgt = nodeById.get(targetId)?.label || targetId;
    tooltipRef.current.innerHTML = `
      <div style="font-size:12px;color:${titleColor};font-weight:600;margin-bottom:4px">${relationLabel}</div>
      <div style="font-size:11px;color:${metaColor};font-family:var(--mono);margin-bottom:4px">${src} → ${tgt}</div>
      <div style="font-size:11px;color:${metaColor};line-height:1.35">${relationMeaning}</div>
    `;
    tooltipRef.current.style.display = 'block';
  }, [nodeById, theme]);

  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
  }, []);

  useEffect(() => {
    if (!centerNodeId || !svgRef.current || !zoomBehaviorRef.current) return;
    const target = nodeById.get(centerNodeId);
    if (!target) return;
    const k = Math.min(2.2, Math.max(0.8, zoomLevel || 1));
    const tx = viewportSize.width / 2 - target.x * k;
    const ty = viewportSize.height / 2 - target.y * k;
    const transform = d3.zoomIdentity.translate(tx, ty).scale(k);
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.transform as any, transform);
  }, [centerNodeId, nodeById, zoomLevel, viewportSize.width, viewportSize.height]);

  const isDark = theme === 'dark';
  const panelBg = isDark ? '#112523' : '#f8f3e6';
  const panelBorder = isDark ? 'rgba(238,241,234,0.12)' : 'rgba(31,46,40,0.14)';
  const textColor = isDark ? '#eef1ea' : '#1f2e28';
  const text3Color = isDark ? '#71897f' : '#7c8d80';

  const defs = (
    <defs>
      <marker id="graph-arrow" markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L0,4 L3.8,2 z" fill={isDark ? '#9fb3ac' : '#4d5f54'} />
      </marker>
      <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <pattern id="carto-field-grid" width="26" height="26" patternUnits="userSpaceOnUse">
        <path d="M0 0 L26 0 L26 26 L0 26 Z" fill="none" stroke={isDark ? 'rgba(238,241,234,0.035)' : 'rgba(31,46,40,0.05)'} strokeWidth="1" />
      </pattern>
    </defs>
  );

  const minimapData = useMemo(() => {
    if (simNodes.length === 0) return null;
    const minX = Math.min(...simNodes.map((n) => n.x));
    const maxX = Math.max(...simNodes.map((n) => n.x));
    const minY = Math.min(...simNodes.map((n) => n.y));
    const maxY = Math.max(...simNodes.map((n) => n.y));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    return { minX, maxX, minY, maxY, width, height };
  }, [simNodes]);

  const graphSvg = (
    <svg
      ref={svgRef}
      width={viewportSize.width}
      height={showControls ? height : viewportSize.height}
      role="img"
      aria-label="Stakeholder entity graph visualization"
      style={{ display: 'block', width: '100%', height: '100%', background: isDark ? '#0c1819' : '#efe9d8', cursor: 'grab' }}
      onClick={(evt) => {
        if (evt.target === svgRef.current) {
          onBackgroundClickRef.current?.();
          setFocusMode(null);
          setHoverNodeId(null);
          setHoverEdgeId(null);
          hideTooltip();
        }
      }}
    >
      {defs}
      {/* Fixed survey-sheet texture — a faint grid plus contour rings centered on
          the viewport, deliberately not part of the pan/zoom group so it reads
          as the "paper" the network is drawn on, not as part of the data. */}
      <rect
        x={0} y={0} width={viewportSize.width} height={showControls ? height : viewportSize.height}
        fill="url(#carto-field-grid)" pointerEvents="none"
      />
      <g fill="none" stroke={isDark ? 'rgba(238,241,234,0.05)' : 'rgba(31,46,40,0.06)'} strokeWidth={1} pointerEvents="none">
        <circle cx={viewportSize.width / 2} cy={(showControls ? height : viewportSize.height) / 2} r={Math.min(viewportSize.width, height) * 0.22} />
        <circle cx={viewportSize.width / 2} cy={(showControls ? height : viewportSize.height) / 2} r={Math.min(viewportSize.width, height) * 0.38} />
        <circle cx={viewportSize.width / 2} cy={(showControls ? height : viewportSize.height) / 2} r={Math.min(viewportSize.width, height) * 0.54} />
      </g>
      <g ref={viewportGroupRef}>
        {simEdges.map((edge) => {
          const source = typeof edge.source === 'string' ? nodeById.get(edge.source) : edge.source;
          const target = typeof edge.target === 'string' ? nodeById.get(edge.target) : edge.target;
          if (!source || !target) return null;

          const sourceDegreeBoost = Math.sqrt(Math.max(0, source.degree || 0)) * 1.6;
          const sourceRadius = Math.max(18, (source.node_size || 44) * 0.56 + sourceDegreeBoost);
          const targetDegreeBoost = Math.sqrt(Math.max(0, target.degree || 0)) * 1.6;
          const targetRadius = Math.max(18, (target.node_size || 44) * 0.56 + targetDegreeBoost);

          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const norm = Math.sqrt(dx * dx + dy * dy) || 1;
          const startX = source.x + (dx / norm) * (sourceRadius + 2);
          const startY = source.y + (dy / norm) * (sourceRadius + 2);
          const endX = target.x - (dx / norm) * (targetRadius + 5);
          const endY = target.y - (dy / norm) * (targetRadius + 5);
          const curveOffset = 20;
          const cx = ((startX + endX) / 2) - (dy / norm) * curveOffset;
          const cy = ((startY + endY) / 2) + (dx / norm) * curveOffset;
          const dimmed = isEdgeDimmed(edge);
          const confidence = Math.max(0, Math.min(1, edge.confidence ?? 0.6));
          const baseStroke = Math.max(1.4, edge.edge_width || 1.2);
          const strokeWidth = baseStroke + confidence * 1.4;
          const edgeOpacity = dimmed ? 0.12 : Math.max(0.5, 0.55 + confidence * 0.4);
          const edgeColor = isDark ? '#cfd9d3' : '#2f3f3a';
          const edgeLabelColor = isDark ? '#eef1ea' : '#1f2e28';
          const edgeLabelHalo = isDark ? '#0c1819' : '#efe9d8';

          return (
            <g
              key={edge.id}
              opacity={edgeOpacity}
              onMouseEnter={(event) => {
                setHoverEdgeId(edge.id);
                showEdgeTooltip(edge);
                updateTooltipPosition(event);
              }}
              onMouseMove={(event) => {
                if (hoverEdgeId === edge.id) updateTooltipPosition(event);
              }}
              onMouseLeave={() => {
                setHoverEdgeId(prev => (prev === edge.id ? null : prev));
                hideTooltip();
              }}
            >
              <path
                d={`M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`}
                fill="none"
                stroke={edgeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                markerEnd="url(#graph-arrow)"
              />
              {edge.label ? (
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  fontSize={Math.max(12, fontSize + 1)}
                  fontFamily="var(--mono)"
                  fill={edgeLabelColor}
                  stroke={edgeLabelHalo}
                  strokeWidth={4}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {(() => {
          const maxDegree = Math.max(1, ...simNodes.map((n) => n.degree || 0));
          return simNodes.map((node) => {
          const dimmed = isNodeDimmed(node.id);
          const isSearchHit = highlightNodeIds.includes(node.id);
          const isFocused = focusMode?.nodeId === node.id;
          const isIsolated = isolatedNodeIds.has(node.id);
          // Nodes well above the pack in connection count get a small benchmark
          // cross-mark, like a surveyed reference point on a topographic sheet —
          // a quiet visual cue for "this one matters" independent of its label.
          const isBenchmark = (node.degree || 0) >= Math.max(3, maxDegree * 0.7);
          const degreeBoost = Math.sqrt(Math.max(0, node.degree || 0)) * 1.6;
          const radius = Math.max(18, (node.node_size || 44) * 0.56 + degreeBoost);
          const haloStroke = isSearchHit ? '#f0c468' : 'var(--accent)';
          const haloSize = radius + (isFocused ? 9 : isSearchHit ? 7 : 5);
          const nodeOutline = isDark ? '#0c1819' : '#efe9d8';
          const labelColor = isDark ? '#eef1ea' : '#1f2e28';
          const labelHalo = isDark ? '#0c1819' : '#efe9d8';

          return (
            <g
              key={node.id}
              className="graph-node"
              data-node-id={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              opacity={dimmed ? 0.16 : 1}
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(node, e);
              }}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setSimNodes((prev) => prev.map((item) => (
                  item.id === node.id ? { ...item, fx: null, fy: null } : item
                )));
                const targetNode = simulationRef.current?.nodes().find((item) => item.id === node.id);
                if (targetNode) {
                  targetNode.fx = null;
                  targetNode.fy = null;
                }
                simulationRef.current?.alpha(0.2).restart();
              }}
              onMouseEnter={(event) => {
                if (focusModeRef.current) return;
                setHoverNodeId(node.id);
                showNodeTooltip(node);
                updateTooltipPosition(event);
              }}
              onMouseMove={(event) => {
                if (focusModeRef.current) return;
                updateTooltipPosition(event);
              }}
              onMouseLeave={() => {
                if (focusModeRef.current) return;
                setHoverNodeId(prev => (prev === node.id ? null : prev));
                hideTooltip();
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={haloSize}
                fill="none"
                stroke={haloStroke}
                strokeWidth={isFocused || isSearchHit ? 4 : 2.4}
                opacity={isFocused || isSearchHit ? 1 : 0.85}
                filter="url(#node-glow)"
              />
              {isIsolated ? (
                <circle
                  r={haloSize + 3}
                  fill="none"
                  stroke={isDark ? '#c2893c' : '#8a5c1e'}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  opacity={0.9}
                />
              ) : null}
              <circle
                r={radius}
                fill={node.color}
                stroke={nodeOutline}
                strokeWidth={2.2}
              />
              <circle
                r={Math.max(3, radius * 0.26)}
                fill={nodeOutline}
                opacity={0.85}
              />
              {isBenchmark ? (
                <path
                  d={`M ${-radius * 0.26} 0 H ${radius * 0.26} M 0 ${-radius * 0.26} V ${radius * 0.26}`}
                  stroke={nodeOutline}
                  strokeWidth={1.4}
                  opacity={0.9}
                />
              ) : null}
              <text
                y={radius + 18}
                textAnchor="middle"
                fontFamily="var(--sans)"
                fontSize={Math.max(14, fontSize + 2)}
                fill={labelColor}
                stroke={labelHalo}
                strokeWidth={4}
                paintOrder="stroke"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {node.label}
              </text>
            </g>
          );
          });
        })()}
      </g>
    </svg>
  );

  const tooltip = (
    <div
      ref={tooltipRef}
      style={{
        display: 'none', position: 'absolute', pointerEvents: 'none', zIndex: 50,
        background: panelBg, border: `1px solid ${panelBorder}`,
        borderRadius: 8, padding: '8px 12px',
        fontFamily: 'var(--sans)',
        maxWidth: 220, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    />
  );

  const filterPanel = showFilterPanel ? (
    <>
      <button
        onClick={() => setFilterPanelOpen(o => !o)}
        title="Filters & Layout"
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          width: 32, height: 32, borderRadius: 8,
          background: filterPanelOpen ? 'var(--accent)' : panelBg,
          border: `1px solid ${panelBorder}`,
          color: filterPanelOpen ? '#17262a' : textColor,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}
      >
        ⊟
      </button>

      {filterPanelOpen && (
        <div style={{
          position: 'absolute', top: 56, right: 16, zIndex: 10,
          width: 220, maxHeight: 'calc(100% - 80px)', overflowY: 'auto',
          background: panelBg, border: `1px solid ${panelBorder}`,
          borderRadius: 10, padding: '14px 14px 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
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
                        if (e.target.checked) setFilterEntityTypes(prev => [...prev, type]);
                        else setFilterEntityTypes(prev => prev.filter(t => t !== type));
                      }}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    {type}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: text3Color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Min Confidence: {filterConfMin}%
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={filterConfMin}
              onChange={e => setFilterConfMin(Number(e.target.value))}
              title="Minimum confidence"
              aria-label="Minimum confidence"
              style={{ width: '100%', accentColor: 'var(--accent)' } as any}
            />
          </div>

          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: text3Color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Min Connections: {filterDegMin}
            </div>
            <input
              type="range" min={0} max={maxDegree} step={1}
              value={filterDegMin}
              onChange={e => setFilterDegMin(Number(e.target.value))}
              title="Minimum connections"
              aria-label="Minimum connections"
              style={{ width: '100%', accentColor: 'var(--accent)' } as any}
            />
          </div>

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
                    color: clusterMode === mode ? '#17262a' : textColor,
                    fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)',
                  }}
                >
                  {mode === 'none' ? 'Default' : 'By Type'}
                </button>
              ))}
            </div>
          </div>

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

  const sizeLegend = showLegend ? (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 5,
      background: panelBg, border: `1px solid ${panelBorder}`,
      borderRadius: 8, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none', maxWidth: 170,
    }}>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: textColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Entity Types
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {allEntityTypes.filter(t => TYPE_PALETTE[t]).map(type => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: TYPE_PALETTE[type],
                boxShadow: `0 0 4px ${TYPE_PALETTE[type]}80`,
              }} />
              <span style={{ fontSize: 12, color: textColor, fontFamily: 'var(--mono)' }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: textColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Size = connections
        </div>
        {[
          { label: 'Few', size: 10 },
          { label: 'Moderate', size: 16 },
          { label: 'Many', size: 22 },
        ].map(({ label, size }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${text3Color}`, background: 'transparent' }} />
            <span style={{ fontSize: 12, color: textColor, fontFamily: 'var(--mono)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const minimapOverlay = minimapData ? (() => {
    const miniW = 170;
    const miniH = 120;
    const pad = 10;
    const sx = (x: number) => pad + ((x - minimapData.minX) / minimapData.width) * (miniW - pad * 2);
    const sy = (y: number) => pad + ((y - minimapData.minY) / minimapData.height) * (miniH - pad * 2);

    const worldLeft = (-zoomTransform.x) / Math.max(0.001, zoomTransform.k);
    const worldTop = (-zoomTransform.y) / Math.max(0.001, zoomTransform.k);
    const worldWidth = viewportSize.width / Math.max(0.001, zoomTransform.k);
    const worldHeight = viewportSize.height / Math.max(0.001, zoomTransform.k);

    const viewX = sx(worldLeft);
    const viewY = sy(worldTop);
    const viewW = (worldWidth / minimapData.width) * (miniW - pad * 2);
    const viewH = (worldHeight / minimapData.height) * (miniH - pad * 2);

    return (
      <div style={{
        position: 'absolute', right: 16, bottom: 16, zIndex: 9,
        width: miniW, height: miniH,
        background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8,
        padding: 4, pointerEvents: 'none',
      }}>
        <svg width={miniW - 8} height={miniH - 8} viewBox={`0 0 ${miniW} ${miniH}`}>
          <rect x={0} y={0} width={miniW} height={miniH} fill={isDark ? '#0a1515' : '#efe6d3'} rx={6} ry={6} />
          {simEdges.map((edge) => {
            const source = typeof edge.source === 'string' ? nodeById.get(edge.source) : edge.source;
            const target = typeof edge.target === 'string' ? nodeById.get(edge.target) : edge.target;
            if (!source || !target) return null;
            return (
              <line
                key={`mini-${edge.id}`}
                x1={sx(source.x)}
                y1={sy(source.y)}
                x2={sx(target.x)}
                y2={sy(target.y)}
                stroke={isDark ? '#6f8c86' : '#9c8f72'}
                strokeWidth={0.8}
                opacity={0.75}
              />
            );
          })}
          {simNodes.map((node) => (
            <circle
              key={`mini-node-${node.id}`}
              cx={sx(node.x)}
              cy={sy(node.y)}
              r={2}
              fill={node.color}
              opacity={0.92}
            />
          ))}
          <rect
            x={Math.max(0, viewX)}
            y={Math.max(0, viewY)}
            width={Math.max(8, viewW)}
            height={Math.max(8, viewH)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
            rx={3}
            ry={3}
          />
        </svg>
      </div>
    );
  })() : null;

  const controlsOverlay = (
    <div style={{
      position: 'absolute', left: 16, top: 16, zIndex: 9,
      display: 'flex', alignItems: 'center', gap: 6,
      background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8,
      padding: '6px 8px',
    }}>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          letterSpacing: '0.06em',
          color: '#17262a',
          background: 'var(--accent)',
          borderRadius: 4,
          padding: '2px 6px',
        }}
      >
        D3
      </span>
      <button onClick={() => zoomBehaviorRef.current && d3.select(svgRef.current).transition().duration(160).call(zoomBehaviorRef.current.scaleBy as any, 1.2)} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>+</button>
      <button onClick={() => zoomBehaviorRef.current && d3.select(svgRef.current).transition().duration(160).call(zoomBehaviorRef.current.scaleBy as any, 1 / 1.2)} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>−</button>
      <button onClick={() => fitView()} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>Fit</button>
      <button onClick={resetLayout} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>Reset</button>
      <button
        onClick={() => setHideIsolatedNodes((prev) => !prev)}
        className="btn-ghost"
        style={{
          fontSize: 11,
          padding: '4px 8px',
          borderColor: hideIsolatedNodes ? 'var(--accent)' : undefined,
          color: hideIsolatedNodes ? 'var(--accent)' : undefined,
        }}
        title="Toggle isolated stakeholders"
      >
        {hideIsolatedNodes ? 'Show Isolated' : 'Hide Isolated'}
      </button>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: text3Color, minWidth: 54, textAlign: 'right' }}>{Math.round(zoomLevel * 100)}%</span>
    </div>
  );

  const focusBar = focusMode ? (() => {
    const focusedNode = nodes.find(n => n.id === focusMode.nodeId);
    return (
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', alignItems: 'center', gap: 8,
        background: panelBg, border: `1px solid ${panelBorder}`,
        borderRadius: 8, padding: '6px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <span style={{ fontSize: 11, color: text3Color, fontFamily: 'var(--mono)' }}>Focus:</span>
        <span style={{ fontSize: 12, color: textColor, fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {focusedNode?.label ?? focusMode.nodeId}
        </span>
        {([1, 2] as const).map(hop => (
          <button
            key={hop}
            onClick={() => setFocusMode(prev => (prev ? { ...prev, hopRadius: hop } : null))}
            title={`${hop}-hop neighbourhood`}
            style={{
              padding: '2px 8px', borderRadius: 4, border: `1px solid ${panelBorder}`,
              background: focusMode.hopRadius === hop ? 'var(--accent)' : 'transparent',
              color: focusMode.hopRadius === hop ? '#17262a' : text3Color,
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
            background: 'transparent', color: text3Color, fontSize: 11, cursor: 'pointer',
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
          <button onClick={() => fitView()} className="btn-ghost" style={{ fontSize: 11 }}>Fit View</button>
          <button onClick={resetLayout} className="btn-ghost" style={{ fontSize: 11 }}>Reset Layout</button>
        </div>
        <div ref={containerRef} style={{ position: 'relative', width: '100%', height, borderRadius: 8, overflow: 'hidden' }}>
          {graphSvg}
          {tooltip}
          {controlsOverlay}
          {minimapOverlay}
        </div>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
          {simNodes.length} node{simNodes.length !== 1 ? 's' : ''} · {simEdges.length} edge{simEdges.length !== 1 ? 's' : ''} · {Math.round(zoomLevel * 100)}%
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 600, overflow: 'hidden' }}>
      {graphSvg}
      {tooltip}
      {controlsOverlay}
      {filterPanel}
      {sizeLegend}
      {minimapOverlay}
      {focusBar}
    </div>
  );
}

export default GraphVisualizationInner;
