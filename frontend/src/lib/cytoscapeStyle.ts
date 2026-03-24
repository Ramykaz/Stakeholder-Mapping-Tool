// Cytoscape.js stylesheet — theme-adaptive
// All nodes are circles (ellipse). Border colour is the only type differentiator.
// Call buildCytoscapeStylesheet(theme) to get the active stylesheet.

import { Theme } from '@/lib/uiState';

const BORDER_COLORS: Record<string, string> = {
  PERSON:       '#2edfb8',
  ORGANIZATION: '#5b8fff',
  GOVERNMENT:   '#5b8fff',
  LOCATION:     '#ffc044',
  ROLE:         '#e879a0',
  EVENT:        '#af7fff',
  PROJECT:      '#af7fff',
  POLICY:       '#af7fff',
  CONCEPT:      '#ff6f55',
  THEME:        '#ff6f55',
};

const DEFAULT_BORDER_COLOR = '#e879a0';

function buildTypeSelector(entityType: string, theme: Theme): cytoscape.StylesheetStyle {
  const border = BORDER_COLORS[entityType] || DEFAULT_BORDER_COLOR;
  return {
    selector: `node[entity_type="${entityType}"]`,
    style: {
      'border-color': border,
    },
  };
}

export function buildCytoscapeStylesheet(theme: Theme): cytoscape.StylesheetStyle[] {
  const isDark = theme === 'dark';
  const nodeFill        = isDark ? 'rgba(13,18,32,0.72)'  : 'rgba(240,236,226,0.82)';
  const nodeTextColor   = isDark ? '#e2e8f0'              : '#1a1f2e';
  const textOutline     = isDark ? '#080c14'              : '#f0ece2';
  const edgeLineColor   = isDark ? '#2a3553'              : '#b8c0d8';
  const edgeTextBg      = isDark ? '#0d1220'              : '#f0ece2';
  const edgeTextColor   = isDark ? '#8892aa'              : '#4a5570';

  return [
    // ── Base node ──
    {
      selector: 'node',
      style: {
        shape: 'ellipse' as any,
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
        'background-color': nodeFill,
        'border-color': DEFAULT_BORDER_COLOR,
        color: nodeTextColor,
        'text-outline-color': textOutline,
        'text-outline-width': 1,
      },
    },

    // ── Per entity-type border colour ──
    ...Object.keys(BORDER_COLORS).map(t => buildTypeSelector(t, theme)),

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

    // ── Focused node (persistent focus mode) ──
    {
      selector: '.focus-node',
      style: {
        'border-width': 4,
        'border-color': '#ffffff',
        'overlay-color': '#ffffff',
        'overlay-opacity': 0.18,
      } as any,
    },

    // ── Edge ──
    {
      selector: 'edge',
      style: {
        width: 'data(edge_width)',
        'line-color': edgeLineColor,
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': edgeLineColor,
        label: 'data(label)',
        'font-size': '9px',
        'text-rotation': 'autorotate',
        'text-margin-y': -8,
        'text-background-color': edgeTextBg,
        'text-background-opacity': 0.9,
        'text-background-padding': '2px' as any,
        'text-background-shape': 'roundrectangle' as any,
        color: edgeTextColor,
        'font-weight': '500' as any,
      },
    },

    // ── Dimmed ──
    {
      selector: '.dimmed',
      style: { opacity: 0.12 },
    },

    // ── Neighbourhood highlight ──
    { selector: '.neighbour-node', style: { opacity: 1.0 } as any },
    { selector: '.neighbour-edge', style: { opacity: 1.0 } as any },

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
}

// Default export: dark theme stylesheet (backwards-compat for non-theme-aware callers)
export const cytoscapeStylesheet = buildCytoscapeStylesheet('dark');

// Legacy colour exports
const ENTITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {};
Object.entries(BORDER_COLORS).forEach(([k, border]) => {
  ENTITY_COLORS[k] = { bg: 'rgba(13,18,32,0.72)', border, text: '#e2e8f0' };
});
const DEFAULT_COLOR = { bg: 'rgba(13,18,32,0.72)', border: DEFAULT_BORDER_COLOR, text: '#e2e8f0' };
function getColor(entityType: string) { return ENTITY_COLORS[entityType] || DEFAULT_COLOR; }

export { ENTITY_COLORS, DEFAULT_COLOR, getColor };
