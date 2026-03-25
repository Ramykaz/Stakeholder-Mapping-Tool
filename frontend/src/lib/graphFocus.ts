import { CytoscapeEdge, CytoscapeNode } from '@/types';

export function computeTwoHopNeighborhood(
  anchorNodeId: string,
  nodes: CytoscapeNode[],
  edges: CytoscapeEdge[],
  maxHops = 2,
): string[] {
  if (!anchorNodeId) {
    return [];
  }

  if (maxHops < 1) {
    return [anchorNodeId];
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  if (!nodeIds.has(anchorNodeId)) {
    return [];
  }

  if (edges.length === 0) {
    return [anchorNodeId];
  }

  const adjacency = new Map<string, Set<string>>();
  nodeIds.forEach((id) => adjacency.set(id, new Set()));

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      return;
    }
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  const visited = new Set<string>([anchorNodeId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: anchorNodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (current.depth >= maxHops) {
      continue;
    }

    adjacency.get(current.id)?.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, depth: current.depth + 1 });
      }
    });
  }

  return Array.from(visited);
}

/** Map a node's degree to a pixel size in [minPx, maxPx]. */
export function mapDegreeToSize(
  degree: number,
  minDeg: number,
  maxDeg: number,
  minPx = 36,
  maxPx = 84,
): number {
  if (minDeg === maxDeg || maxDeg <= 0) return Math.round((minPx + maxPx) / 2);
  const ratio = Math.max(0, Math.min(1, (degree - minDeg) / (maxDeg - minDeg)));
  return Math.round(minPx + ratio * (maxPx - minPx));
}

const TYPE_ORDER = [
  'PERSON', 'ORGANIZATION', 'GOVERNMENT', 'LOCATION',
  'ROLE', 'EVENT', 'PROJECT', 'POLICY', 'CONCEPT', 'THEME',
];

/**
 * Compute pre-seeded positions for a type-based cluster layout.
 * Groups nodes by entity type, arranges groups in a circle.
 * Returns nodeId → {x, y}.
 */
export function computeClusterPositions(
  nodes: CytoscapeNode[],
  canvasWidth = 1200,
  canvasHeight = 800,
): Map<string, { x: number; y: number }> {
  const groups = new Map<string, CytoscapeNode[]>();
  for (const node of nodes) {
    const type = node.data.entity_type || 'OTHER';
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(node);
  }

  const types = Array.from(groups.keys()).sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a);
    const bi = TYPE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const positions = new Map<string, { x: number; y: number }>();
  const total = Math.max(types.length, 1);
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const radius = Math.min(canvasWidth, canvasHeight) * 0.35;

  types.forEach((type, typeIdx) => {
    const angle = (2 * Math.PI * typeIdx) / total - Math.PI / 2;
    const groupCx = cx + radius * Math.cos(angle);
    const groupCy = cy + radius * Math.sin(angle);
    const groupNodes = groups.get(type)!;
    const spread = Math.min(140, 35 * Math.sqrt(groupNodes.length));

    groupNodes.forEach((node, i) => {
      const nodeAngle = (2 * Math.PI * i) / Math.max(groupNodes.length, 1);
      const nodeRadius = groupNodes.length === 1 ? 0 : spread * Math.max(0.3, i / Math.max(groupNodes.length - 1, 1));
      positions.set(node.id, {
        x: groupCx + nodeRadius * Math.cos(nodeAngle),
        y: groupCy + nodeRadius * Math.sin(nodeAngle),
      });
    });
  });

  return positions;
}
