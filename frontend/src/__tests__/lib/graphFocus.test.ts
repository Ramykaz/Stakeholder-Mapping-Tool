/**
 * Unit tests for src/lib/graphFocus.ts
 * Covers computeTwoHopNeighborhood, mapDegreeToSize, computeClusterPositions
 */

import {
  computeTwoHopNeighborhood,
  mapDegreeToSize,
  computeClusterPositions,
} from '@/lib/graphFocus';

// ---------------------------------------------------------------------------
// Minimal node/edge fixtures
// ---------------------------------------------------------------------------
const node = (id: string, type = 'ORG') => ({
  id,
  data: { id, label: id, entity_type: type, node_size: 40, confidence: 0.9, degree: 1 },
});

const edge = (source: string, target: string) => ({
  id: `${source}-${target}`,
  source,
  target,
  data: { id: `${source}-${target}`, label: 'REL', confidence: 0.8, edge_width: 2 },
});

// ---------------------------------------------------------------------------
// computeTwoHopNeighborhood
// ---------------------------------------------------------------------------
describe('computeTwoHopNeighborhood', () => {
  test('empty anchorNodeId returns empty array', () => {
    expect(computeTwoHopNeighborhood('', [], [])).toEqual([]);
  });

  test('anchor not in node list returns empty array', () => {
    const nodes = [node('A'), node('B')];
    expect(computeTwoHopNeighborhood('X', nodes, [])).toEqual([]);
  });

  test('anchor with no edges returns just itself', () => {
    const nodes = [node('A'), node('B')];
    expect(computeTwoHopNeighborhood('A', nodes, [])).toEqual(['A']);
  });

  test('direct neighbor included at hop 1', () => {
    const nodes = [node('A'), node('B'), node('C')];
    const edges = [edge('A', 'B')];
    const result = computeTwoHopNeighborhood('A', nodes, edges, 1);
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).not.toContain('C');
  });

  test('two-hop neighbor included at hop 2', () => {
    const nodes = [node('A'), node('B'), node('C')];
    const edges = [edge('A', 'B'), edge('B', 'C')];
    const result = computeTwoHopNeighborhood('A', nodes, edges, 2);
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
  });

  test('three-hop node excluded when maxHops=2', () => {
    const nodes = [node('A'), node('B'), node('C'), node('D')];
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'D')];
    const result = computeTwoHopNeighborhood('A', nodes, edges, 2);
    expect(result).not.toContain('D');
  });

  test('maxHops=0 returns only anchor', () => {
    const nodes = [node('A'), node('B')];
    const edges = [edge('A', 'B')];
    expect(computeTwoHopNeighborhood('A', nodes, edges, 0)).toEqual(['A']);
  });

  test('graph is treated as undirected (reverse edge traversed)', () => {
    const nodes = [node('A'), node('B')];
    const edges = [edge('B', 'A')]; // edge goes B→A but A should still reach B
    const result = computeTwoHopNeighborhood('A', nodes, edges, 1);
    expect(result).toContain('B');
  });

  test('edges with unknown nodes are ignored', () => {
    const nodes = [node('A')];
    const edges = [edge('A', 'UNKNOWN')];
    const result = computeTwoHopNeighborhood('A', nodes, edges);
    expect(result).toEqual(['A']);
  });
});

// ---------------------------------------------------------------------------
// mapDegreeToSize
// ---------------------------------------------------------------------------
describe('mapDegreeToSize', () => {
  test('returns midpoint when minDeg === maxDeg', () => {
    const mid = mapDegreeToSize(5, 5, 5, 36, 84);
    expect(mid).toBe(Math.round((36 + 84) / 2));
  });

  test('returns minPx for degree at minDeg', () => {
    expect(mapDegreeToSize(0, 0, 10, 36, 84)).toBe(36);
  });

  test('returns maxPx for degree at maxDeg', () => {
    expect(mapDegreeToSize(10, 0, 10, 36, 84)).toBe(84);
  });

  test('returns midpoint for degree at midpoint', () => {
    const result = mapDegreeToSize(5, 0, 10, 0, 100);
    expect(result).toBe(50);
  });

  test('clamps below min to minPx', () => {
    expect(mapDegreeToSize(-5, 0, 10, 36, 84)).toBe(36);
  });

  test('clamps above max to maxPx', () => {
    expect(mapDegreeToSize(20, 0, 10, 36, 84)).toBe(84);
  });

  test('uses defaults minPx=36 maxPx=84', () => {
    const result = mapDegreeToSize(0, 0, 10);
    expect(result).toBe(36);
  });
});

// ---------------------------------------------------------------------------
// computeClusterPositions
// ---------------------------------------------------------------------------
describe('computeClusterPositions', () => {
  test('returns empty map for no nodes', () => {
    const positions = computeClusterPositions([]);
    expect(positions.size).toBe(0);
  });

  test('returns entry for each node', () => {
    const nodes = [node('A', 'PERSON'), node('B', 'ORG'), node('C', 'PERSON')];
    const positions = computeClusterPositions(nodes);
    expect(positions.size).toBe(3);
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(true);
    expect(positions.has('C')).toBe(true);
  });

  test('each position has numeric x and y', () => {
    const nodes = [node('A', 'PERSON')];
    const positions = computeClusterPositions(nodes);
    const pos = positions.get('A')!;
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  test('nodes of same type are grouped (similar positions)', () => {
    const nodes = [
      node('A', 'PERSON'),
      node('B', 'PERSON'),
      node('C', 'ORG'),
    ];
    const positions = computeClusterPositions(nodes, 1200, 800);
    // All positions should be within the canvas bounds (roughly)
    for (const [, pos] of positions) {
      expect(pos.x).toBeGreaterThan(-200);
      expect(pos.x).toBeLessThan(1400);
      expect(pos.y).toBeGreaterThan(-200);
      expect(pos.y).toBeLessThan(1000);
    }
  });
});
