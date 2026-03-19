// Cytoscape.js stylesheet — original dark design system (restored)
// Node colours: semi-transparent fill + vivid border, text centered with dark outline
// Hover tooltip behaviour lives in GraphVisualization.tsx

const DARK_NODE_COLORS: Record<string, { fg: string; bg: string }> = {
  PERSON:       { fg: '#2edfb8', bg: 'rgba(46,223,184,0.16)'  },   // vivid teal
  ORGANIZATION: { fg: '#5b8fff', bg: 'rgba(91,143,255,0.16)'  },   // bright blue
  GOVERNMENT:   { fg: '#5b8fff', bg: 'rgba(91,143,255,0.16)'  },   // bright blue
  LOCATION:     { fg: '#ffc044', bg: 'rgba(255,192,68,0.16)'  },   // gold
  ROLE:         { fg: '#e879a0', bg: 'rgba(232,121,160,0.16)' },   // hot pink (was grey)
  EVENT:        { fg: '#af7fff', bg: 'rgba(175,127,255,0.16)' },   // lavender
  PROJECT:      { fg: '#af7fff', bg: 'rgba(175,127,255,0.16)' },   // lavender
  POLICY:       { fg: '#af7fff', bg: 'rgba(175,127,255,0.16)' },   // lavender
  CONCEPT:      { fg: '#ff6f55', bg: 'rgba(255,111,85,0.16)'  },   // coral
  THEME:        { fg: '#ff6f55', bg: 'rgba(255,111,85,0.16)'  },   // coral
};

const DEFAULT_NODE_COLOR = { fg: '#e879a0', bg: 'rgba(232,121,160,0.12)' };

function buildTypeSelector(entityType: string): cytoscape.StylesheetStyle {
  const c = DARK_NODE_COLORS[entityType] || DEFAULT_NODE_COLOR;
  return {
    selector: `node[entity_type="${entityType}"]`,
    style: {
      'background-color': c.bg,
      'border-color': c.fg,
      color: '#e2e8f0',
    },
  };
}

export const cytoscapeStylesheet: cytoscape.StylesheetStyle[] = [
  // ── Base node ──
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '11px',
      'font-weight': 'bold' as any,
      width: 'data(node_size)',
      height: 'data(node_size)',
      'text-wrap': 'wrap',
      'text-max-width': '80px',
      'border-width': 2,
      'overlay-padding': '4px',
      'background-color': DEFAULT_NODE_COLOR.bg,
      'border-color': 'data(color)',
      color: '#e2e8f0',
      'text-outline-color': '#080c14',
      'text-outline-width': 1,
      shape: 'data(shape)' as any,
    },
  },

  // ── Per entity-type colour overrides ──
  ...Object.keys(DARK_NODE_COLORS).map(buildTypeSelector),

  // ── Selected node ──
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-color': '#3d6fff',
      'overlay-color': '#3d6fff',
      'overlay-opacity': 0.15,
    },
  },

  // ── Edge ──
  {
    selector: 'edge',
    style: {
      width: 'data(edge_width)',
      'line-color': '#2a3553',
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#2a3553',
      label: 'data(label)',
      'font-size': '9px',
      'text-rotation': 'autorotate',
      'text-margin-y': -8,
      'text-background-color': '#0d1220',
      'text-background-opacity': 0.9,
      'text-background-padding': '2px' as any,
      'text-background-shape': 'roundrectangle' as any,
      color: '#8892aa',
      'font-weight': '500' as any,
    },
  },

  // ── Dimmed (hover neighbourhood) ──
  {
    selector: '.dimmed',
    style: {
      opacity: 0.18,
    },
  },

  // ── Neighbourhood highlight ──
  {
    selector: '.neighbour-node',
    style: {
      opacity: 1.0,
    } as any,
  },
  {
    selector: '.neighbour-edge',
    style: {
      opacity: 1.0,
    } as any,
  },

  // ── Search hit ──
  {
    selector: '.search-hit',
    style: {
      'border-width': 4,
      'border-color': '#3d6fff',
      'overlay-color': '#3d6fff',
      'overlay-opacity': 0.18,
    },
  },
];

// Legacy exports
const ENTITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {};
Object.entries(DARK_NODE_COLORS).forEach(([k, v]) => {
  ENTITY_COLORS[k] = { bg: v.bg, border: v.fg, text: '#e2e8f0' };
});
const DEFAULT_COLOR = { bg: DEFAULT_NODE_COLOR.bg, border: DEFAULT_NODE_COLOR.fg, text: '#e2e8f0' };
function getColor(entityType: string) { return ENTITY_COLORS[entityType] || DEFAULT_COLOR; }

export { ENTITY_COLORS, DEFAULT_COLOR, getColor };
