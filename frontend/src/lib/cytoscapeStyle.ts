// Cytoscape.js stylesheet — theme-adaptive, advanced visualization
import { Theme } from '@/lib/uiState';

const TYPE_PALETTE: Record<string, string> = {
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

const DEFAULT_COLOR = '#e879a0';

function hex2rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildTypeSelector(entityType: string, isDark: boolean): cytoscape.StylesheetStyle {
  const color = TYPE_PALETTE[entityType] || DEFAULT_COLOR;
  return {
    selector: `node[entity_type="${entityType}"]`,
    style: {
      'background-color': color,
      'background-opacity': isDark ? 0.22 : 0.15,
      'border-color': color,
      'shadow-blur': 18,
      'shadow-color': color,
      'shadow-opacity': isDark ? 0.5 : 0.22,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
    } as any,
  };
}

export function buildCytoscapeStylesheet(theme: Theme): cytoscape.StylesheetStyle[] {
  const isDark = theme === 'dark';

  const nodeTextColor   = isDark ? '#e8eaf6' : '#1a1f2e';
  const labelBg         = isDark ? '#0d1220' : '#f5f3ee';
  const edgeLineColor   = isDark ? '#3a4a72' : '#9aa4c4';
  const edgeTextBg      = isDark ? '#080c18' : '#eeeae0';
  const edgeTextColor   = isDark ? '#6b7aa0' : '#5a6480';

  return [
    // ── Base node ──────────────────────────────────────────────────────────
    {
      selector: 'node',
      style: {
        shape: 'ellipse' as any,
        label: 'data(label)',
        'text-valign': 'bottom' as any,
        'text-halign': 'center' as any,
        'text-margin-y': 8,
        'font-size': '11px',
        'font-weight': '600' as any,
        'font-family': 'Figtree, Outfit, system-ui, sans-serif',
        width: 'data(node_size)',
        height: 'data(node_size)',
        'text-wrap': 'ellipsis' as any,
        'text-max-width': '88px',
        'border-width': 2.5,
        'border-opacity': 1,
        'overlay-padding': '6px',
        'background-color': DEFAULT_COLOR,
        'background-opacity': isDark ? 0.22 : 0.15,
        'border-color': DEFAULT_COLOR,
        color: nodeTextColor,
        'text-outline-width': 0,
        'text-background-color': labelBg,
        'text-background-opacity': 0.82,
        'text-background-padding': '3px' as any,
        'text-background-shape': 'roundrectangle' as any,
        'shadow-blur': 18,
        'shadow-color': DEFAULT_COLOR,
        'shadow-opacity': isDark ? 0.4 : 0.18,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'transition-property': 'opacity, border-width, shadow-blur' as any,
        'transition-duration': '0.15s' as any,
      },
    },

    // ── Per entity-type colour ──────────────────────────────────────────────
    ...Object.keys(TYPE_PALETTE).map(t => buildTypeSelector(t, isDark)),

    // ── Selected node ──────────────────────────────────────────────────────
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#ffffff',
        'shadow-blur': 28,
        'shadow-color': '#ffffff',
        'shadow-opacity': 0.55,
        'overlay-color': '#ffffff',
        'overlay-opacity': 0.08,
      } as any,
    },

    // ── Focus node (click) ─────────────────────────────────────────────────
    {
      selector: '.focus-node',
      style: {
        'border-width': 4,
        'border-color': '#ffffff',
        'shadow-blur': 32,
        'shadow-color': '#ffffff',
        'shadow-opacity': 0.65,
        'z-compound-depth': 'top' as any,
      } as any,
    },

    // ── Edge ───────────────────────────────────────────────────────────────
    {
      selector: 'edge',
      style: {
        width: 'data(edge_width)',
        'line-color': edgeLineColor,
        'line-opacity': 0.75,
        'curve-style': 'bezier' as any,
        'target-arrow-shape': 'triangle' as any,
        'target-arrow-color': edgeLineColor,
        'arrow-scale': 1.1,
        label: 'data(label)',
        'font-size': '9px',
        'font-family': 'DM Mono, JetBrains Mono, monospace',
        'font-weight': '500' as any,
        'text-rotation': 'autorotate' as any,
        'text-margin-y': -10,
        'text-background-color': edgeTextBg,
        'text-background-opacity': 0.88,
        'text-background-padding': '2px' as any,
        'text-background-shape': 'roundrectangle' as any,
        color: edgeTextColor,
        'transition-property': 'opacity, line-color' as any,
        'transition-duration': '0.15s' as any,
      },
    },

    // ── Dimmed (unfocused) ─────────────────────────────────────────────────
    {
      selector: '.dimmed',
      style: { opacity: 0.08 },
    },

    // ── Neighbourhood highlight (hover) ────────────────────────────────────
    {
      selector: '.neighbour-node',
      style: {
        opacity: 1,
        'border-width': 3.5,
      } as any,
    },
    {
      selector: '.neighbour-edge',
      style: {
        opacity: 1,
        'line-opacity': 1,
        width: 2.5,
      } as any,
    },

    // ── Search hit ─────────────────────────────────────────────────────────
    {
      selector: '.search-hit',
      style: {
        'border-width': 4,
        'border-color': '#f5c542',
        'shadow-blur': 28,
        'shadow-color': '#f5c542',
        'shadow-opacity': 0.75,
        'overlay-color': '#f5c542',
        'overlay-opacity': 0.12,
      } as any,
    },
  ];
}

// Legacy compatibility exports
export const cytoscapeStylesheet = buildCytoscapeStylesheet('dark');

const ENTITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {};
Object.entries(TYPE_PALETTE).forEach(([k, color]) => {
  ENTITY_COLORS[k] = { bg: hex2rgba(color, 0.2), border: color, text: '#e2e8f0' };
});
const DEFAULT_COLOR_OBJ = { bg: hex2rgba(DEFAULT_COLOR, 0.2), border: DEFAULT_COLOR, text: '#e2e8f0' };
function getColor(entityType: string) { return ENTITY_COLORS[entityType] || DEFAULT_COLOR_OBJ; }

export { ENTITY_COLORS, DEFAULT_COLOR_OBJ as DEFAULT_COLOR, getColor };
