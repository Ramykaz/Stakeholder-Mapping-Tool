/**
 * Unit tests for src/lib/entityNeighborhood.ts
 * Covers buildEntityNeighborhood
 */

import { buildEntityNeighborhood } from '@/lib/entityNeighborhood';

const baseProfile = {
  id: 'center-1',
  canonical_name: 'UNDP',
  entity_type: 'ORG',
  normalized_name: 'undp',
  confidence: 0.95,
  mention_count_dedup: 5,
  raw_mentions: ['UNDP'],
  description: null,
  description_source: null,
  relationships: [],
};

describe('buildEntityNeighborhood', () => {
  test('no relationships → only center node, no edges', () => {
    const { nodes, edges } = buildEntityNeighborhood(baseProfile as any);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].isCenter).toBe(true);
    expect(nodes[0].id).toBe('center-1');
    expect(edges).toHaveLength(0);
  });

  test('one relationship adds one neighbor node and one edge', () => {
    const profile = {
      ...baseProfile,
      relationships: [
        {
          relation_id: 'rel-1',
          source_entity_id: 'center-1',
          source_entity_name: 'UNDP',
          source_entity_type: 'ORG',
          target_entity_id: 'neighbor-1',
          target_entity_name: 'UN Women',
          target_entity_type: 'ORG',
          relation_type: 'PARTNERS_WITH',
        },
      ],
    };
    const { nodes, edges } = buildEntityNeighborhood(profile as any);
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect(edges[0].label).toBe('PARTNERS_WITH');
  });

  test('center node has isCenter=true; neighbor has isCenter=false', () => {
    const profile = {
      ...baseProfile,
      relationships: [
        {
          relation_id: 'rel-1',
          source_entity_id: 'center-1',
          source_entity_name: 'UNDP',
          source_entity_type: 'ORG',
          target_entity_id: 'neighbor-1',
          target_entity_name: 'WHO',
          target_entity_type: 'ORG',
          relation_type: 'FUNDS',
        },
      ],
    };
    const { nodes } = buildEntityNeighborhood(profile as any);
    const center = nodes.find((n) => n.id === 'center-1')!;
    const neighbor = nodes.find((n) => n.id === 'neighbor-1')!;
    expect(center.isCenter).toBe(true);
    expect(neighbor.isCenter).toBe(false);
  });

  test('bidirectional edge detected when reverse relation exists', () => {
    const profile = {
      ...baseProfile,
      relationships: [
        {
          relation_id: 'rel-1',
          source_entity_id: 'center-1',
          source_entity_name: 'UNDP',
          source_entity_type: 'ORG',
          target_entity_id: 'neighbor-1',
          target_entity_name: 'WHO',
          target_entity_type: 'ORG',
          relation_type: 'COLLABORATES',
        },
        {
          relation_id: 'rel-2',
          source_entity_id: 'neighbor-1',
          source_entity_name: 'WHO',
          source_entity_type: 'ORG',
          target_entity_id: 'center-1',
          target_entity_name: 'UNDP',
          target_entity_type: 'ORG',
          relation_type: 'COLLABORATES',
        },
      ],
    };
    const { edges } = buildEntityNeighborhood(profile as any);
    const edge = edges.find((e) => e.id === 'rel-1')!;
    expect(edge.isBidirectional).toBe(true);
  });

  test('deduplicated neighbors: same neighbor via two relations appears once in nodes', () => {
    const profile = {
      ...baseProfile,
      relationships: [
        {
          relation_id: 'rel-1',
          source_entity_id: 'center-1',
          source_entity_name: 'UNDP',
          source_entity_type: 'ORG',
          target_entity_id: 'neighbor-1',
          target_entity_name: 'WHO',
          target_entity_type: 'ORG',
          relation_type: 'FUNDS',
        },
        {
          relation_id: 'rel-2',
          source_entity_id: 'center-1',
          source_entity_name: 'UNDP',
          source_entity_type: 'ORG',
          target_entity_id: 'neighbor-1',
          target_entity_name: 'WHO',
          target_entity_type: 'ORG',
          relation_type: 'MONITORS',
        },
      ],
    };
    const { nodes, edges } = buildEntityNeighborhood(profile as any);
    // Only center + 1 unique neighbor
    expect(nodes).toHaveLength(2);
    // But 2 edges (one per relation)
    expect(edges).toHaveLength(2);
  });

  test('neighbor positions form a ring around center', () => {
    const neighbors = ['n1', 'n2', 'n3', 'n4'].map((id, i) => ({
      relation_id: `rel-${i}`,
      source_entity_id: 'center-1',
      source_entity_name: 'UNDP',
      source_entity_type: 'ORG',
      target_entity_id: id,
      target_entity_name: id,
      target_entity_type: 'ORG',
      relation_type: 'LINKS',
    }));
    const { nodes } = buildEntityNeighborhood({ ...baseProfile, relationships: neighbors } as any);
    const nonCenter = nodes.filter((n) => !n.isCenter);
    // All neighbors should have positions different from center
    const center = nodes.find((n) => n.isCenter)!;
    for (const n of nonCenter) {
      const dist = Math.sqrt((n.x - center.x) ** 2 + (n.y - center.y) ** 2);
      expect(dist).toBeGreaterThan(0);
    }
  });
});
