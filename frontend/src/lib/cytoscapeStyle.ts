// Cytoscape.js stylesheet for stakeholder graph visualization.

const ENTITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PERSON: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  ORGANIZATION: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  LOCATION: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  ROLE: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
};

const DEFAULT_COLOR = { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' };

function getColor(entityType: string) {
  return ENTITY_COLORS[entityType] || DEFAULT_COLOR;
}

export const cytoscapeStylesheet: cytoscape.StylesheetStyle[] = [
  // Base node style
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '11px',
      'font-weight': 'bold' as any,
      width: 'mapData(raw_mentions_count, 1, 20, 40, 80)',
      height: 'mapData(raw_mentions_count, 1, 20, 40, 80)',
      'text-wrap': 'wrap',
      'text-max-width': '80px',
      'border-width': 2,
      'overlay-padding': '4px',
    },
  },
  // PERSON nodes
  {
    selector: 'node[entity_type="PERSON"]',
    style: {
      'background-color': ENTITY_COLORS.PERSON.bg,
      'border-color': ENTITY_COLORS.PERSON.border,
      color: ENTITY_COLORS.PERSON.text,
    },
  },
  // ORGANIZATION nodes
  {
    selector: 'node[entity_type="ORGANIZATION"]',
    style: {
      'background-color': ENTITY_COLORS.ORGANIZATION.bg,
      'border-color': ENTITY_COLORS.ORGANIZATION.border,
      color: ENTITY_COLORS.ORGANIZATION.text,
      shape: 'round-rectangle',
    },
  },
  // LOCATION nodes
  {
    selector: 'node[entity_type="LOCATION"]',
    style: {
      'background-color': ENTITY_COLORS.LOCATION.bg,
      'border-color': ENTITY_COLORS.LOCATION.border,
      color: ENTITY_COLORS.LOCATION.text,
      shape: 'diamond',
    },
  },
  // ROLE nodes
  {
    selector: 'node[entity_type="ROLE"]',
    style: {
      'background-color': ENTITY_COLORS.ROLE.bg,
      'border-color': ENTITY_COLORS.ROLE.border,
      color: ENTITY_COLORS.ROLE.text,
      shape: 'hexagon',
    },
  },
  // Selected node
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-color': '#0468B1',
      'overlay-color': '#0468B1',
      'overlay-opacity': 0.12,
    },
  },
  // Edge style (for future co-occurrence edges)
  {
    selector: 'edge',
    style: {
      width: 2,
      'line-color': '#e5e7eb',
      'curve-style': 'bezier',
      'target-arrow-shape': 'none',
    },
  },
];

export { ENTITY_COLORS, DEFAULT_COLOR, getColor };
