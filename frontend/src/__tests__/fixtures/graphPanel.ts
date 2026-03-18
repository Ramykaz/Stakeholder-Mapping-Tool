export const GRAPH_NODES_FIXTURE = [
  {
    id: 'node-1',
    label: 'UNDP',
    entity_type: 'ORGANIZATION',
    degree: 3,
    style: { shape: 'rectangle', color: '#2563eb' },
    data: {
      entity_id: 'node-1',
      entity_type: 'ORGANIZATION',
      confidence: 0.95,
      document_id: 'doc-1',
      chunk_id: null,
      raw_mentions_count: 4,
      shape: 'rectangle',
      color: '#2563eb',
      degree: 3,
    },
  },
  {
    id: 'node-2',
    label: 'Ministry of Finance',
    entity_type: 'ORGANIZATION',
    degree: 2,
    style: { shape: 'rectangle', color: '#8b5cf6' },
    data: {
      entity_id: 'node-2',
      entity_type: 'ORGANIZATION',
      confidence: 0.91,
      document_id: 'doc-1',
      chunk_id: null,
      raw_mentions_count: 2,
      shape: 'rectangle',
      color: '#8b5cf6',
      degree: 2,
    },
  },
];

export const GRAPH_EDGES_FIXTURE = [
  {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    label: 'FUNDS',
    confidence: 0.82,
  },
];

export const ENTITY_PROFILE_FIXTURE = {
  id: 'node-1',
  canonical_name: 'UNDP',
  entity_type: 'ORGANIZATION',
  aliases: ['United Nations Development Programme'],
  projects: [{ id: 'project-1', name: 'Sudan Water Resilience' }],
  relationships: [
    {
      relation_id: 'edge-1',
      project_id: 'project-1',
      source_entity_id: 'node-1',
      target_entity_id: 'node-2',
      relation_type: 'FUNDS',
      confidence: 0.82,
      supporting_excerpts: ['UNDP funds ministry initiatives'],
    },
  ],
};
