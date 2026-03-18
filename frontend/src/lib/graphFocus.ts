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
