// Cytoscape.js stylesheet for stakeholder graph visualization.

const ENTITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PERSON: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  ORGANIZATION: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  LOCATION: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  ROLE: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
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
      'border-color': '#1d4ed8',
      'overlay-color': '#3b82f6',
      'overlay-opacity': 0.15,
    },
  },
  // Edge style (for future co-occurrence edges)
  {
    selector: 'edge',
    style: {
      width: 2,
      'line-color': '#d1d5db',
      'curve-style': 'bezier',
      'target-arrow-shape': 'none',
    },
  },
];

export { ENTITY_COLORS, DEFAULT_COLOR, getColor };
