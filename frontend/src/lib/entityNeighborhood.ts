import { ProjectEntityDetail } from '@/lib/api';

export interface MiniNode {
  id: string;
  label: string;
  entityType: string;
  isCenter: boolean;
  x: number;
  y: number;
}

export interface MiniEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  isBidirectional: boolean;
  directionText: string;
}

export function buildEntityNeighborhood(profile: ProjectEntityDetail): { nodes: MiniNode[]; edges: MiniEdge[] } {
  const centerId = profile.id;
  const centerLabel = profile.canonical_name;
  const relations = profile.relationships || [];

  const neighborMap = new Map<string, { label: string; entityType: string }>();
  const edges: MiniEdge[] = [];
  const edgePairs = new Set<string>();

  relations.forEach((rel) => {
    edgePairs.add(`${rel.source_entity_id}->${rel.target_entity_id}`);
  });

  relations.forEach((rel) => {
    const sourceId = rel.source_entity_id;
    const targetId = rel.target_entity_id;
    const sourceName = rel.source_entity_name;
    const targetName = rel.target_entity_name;
    const sourceType = rel.source_entity_type || '';
    const targetType = rel.target_entity_type || '';

    if (sourceId !== centerId) {
      neighborMap.set(sourceId, { label: sourceName || sourceId, entityType: sourceType });
    }
    if (targetId !== centerId) {
      neighborMap.set(targetId, { label: targetName || targetId, entityType: targetType });
    }

    const bidirectional = edgePairs.has(`${targetId}->${sourceId}`);

    edges.push({
      id: rel.relation_id,
      sourceId,
      targetId,
      label: rel.relation_type,
      isBidirectional: bidirectional,
      directionText: `${sourceName || sourceId} → ${targetName || targetId}`,
    });
  });

  const neighbors = Array.from(neighborMap.entries());
  const radius = 130;
  const centerX = 200;
  const centerY = 160;

  const nodes: MiniNode[] = [
    { id: centerId, label: centerLabel, entityType: profile.entity_type, isCenter: true, x: centerX, y: centerY },
    ...neighbors.map(([id, meta], index) => {
      const angle = (2 * Math.PI * index) / Math.max(neighbors.length, 1);
      return {
        id,
        label: meta.label,
        entityType: meta.entityType,
        isCenter: false,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    }),
  ];

  return { nodes, edges };
}
