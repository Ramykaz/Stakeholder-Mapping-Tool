// Cytoscape.js stylesheet — theme-adaptive, advanced visualization
import { Theme } from '@/lib/uiState';
import { getEntityColor } from '@/lib/entityTypes';

type GraphStylesheetStyle = {
  selector: string;
  style: Record<string, unknown>;
};

// Derived from the single canonical entity-color map in entityTypes.ts so the
// graph legend always matches entity badges shown elsewhere in the app.
export const TYPE_PALETTE: Record<string, string> = Object.fromEntries(
  ['PERSON', 'ORGANIZATION', 'GOVERNMENT', 'LOCATION', 'ROLE', 'EVENT', 'PROJECT', 'POLICY', 'CONCEPT', 'THEME']
    .map((key) => [key, getEntityColor(key)])
);

const DEFAULT_COLOR = getEntityColor('');

function hex2rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildTypeSelector(entityType: string): GraphStylesheetStyle {
  const color = TYPE_PALETTE[entityType] || DEFAULT_COLOR;
  return {
    selector: `node[entity_type="${entityType}"]`,
    style: {
      'background-color': color,
      'background-opacity': 0.88,
      'border-color': color,
      'border-opacity': 0.35,
      'shadow-blur': 18,
      'shadow-color': color,
      'shadow-opacity': 0.45,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
    } as any,
  };
}

export function buildCytoscapeStylesheet(theme: Theme): GraphStylesheetStyle[] {
  const isDark = theme === 'dark';
  const edgeLineColor    = isDark ? '#3a4a72'  : '#2a3a70';
  const labelColor       = isDark ? '#c8cad8'  : '#1a1f2e';
  const edgeLabelColor   = isDark ? '#7a8099'  : '#1e2850';
  const focusBorderColor = isDark ? '#ffffff'  : '#1a1f2e';
  const selectedShadow   = isDark ? '#ffffff'  : '#1a1f2e';
  const edgeOpacity      = isDark
    ? 'mapData(confidence, 0, 1, 0.25, 0.70)'
    : 'mapData(confidence, 0, 1, 0.50, 0.90)';

  return [
    // ── Base node ──────────────────────────────────────────────────────────
    {
      selector: 'node',
      style: {
        shape: 'ellipse' as any,
        label: 'data(label)',
        'text-valign': 'bottom' as any,
        'text-halign': 'center' as any,
        'text-margin-y': 6,
        'font-size': '11px',
        'font-weight': '400' as any,
        'font-family': '"Public Sans", system-ui, sans-serif',
        width: 'data(node_size)',
        height: 'data(node_size)',
        'text-wrap': 'ellipsis' as any,
        'text-max-width': '100px',
        'border-width': 1.5,
        'border-opacity': 0.35,
        'overlay-padding': '6px',
        'background-color': DEFAULT_COLOR,
        'background-opacity': 0.88,
        'border-color': DEFAULT_COLOR,
        color: labelColor,
        'text-outline-width': 0,
        'text-background-opacity': isDark ? 0 : 0.75,
        'text-background-color': isDark ? 'transparent' : '#f0ece2',
        'text-background-padding': isDark ? '0px' : '2px',
        'text-background-shape': 'roundrectangle' as any,
        'overlay-opacity': 0,
        'shadow-blur': 18,
        'shadow-color': DEFAULT_COLOR,
        'shadow-opacity': 0.4,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'z-index': 10,
        'transition-property': 'opacity, border-width, shadow-blur' as any,
        'transition-duration': '0.15s' as any,
      },
    },

    // ── Per entity-type colour ──────────────────────────────────────────────
    ...Object.keys(TYPE_PALETTE).map(t => buildTypeSelector(t)),

    // ── Selected node ──────────────────────────────────────────────────────
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': focusBorderColor,
        'shadow-blur': 28,
        'shadow-color': selectedShadow,
        'shadow-opacity': 0.55,
        'overlay-color': selectedShadow,
        'overlay-opacity': 0.08,
      } as any,
    },

    // ── Focus node (click) ─────────────────────────────────────────────────
    {
      selector: '.focus-node',
      style: {
        'border-width': 4,
        'border-color': focusBorderColor,
        'shadow-blur': 32,
        'shadow-color': selectedShadow,
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
        opacity: edgeOpacity as any,
        'curve-style': 'bezier' as any,
        'control-point-step-size': 40,
        'target-arrow-shape': 'triangle' as any,
        'target-arrow-color': edgeLineColor,
        'arrow-scale': 0.75,
        label: 'data(label)',
        'font-size': '11px',
        'font-family': '"JetBrains Mono", monospace',
        color: edgeLabelColor,
        'text-rotation': 'autorotate' as any,
        'text-margin-y': -7,
        'text-background-opacity': isDark ? 0.78 : 0.9,
        'text-background-color': isDark ? '#0d1220' : '#f0ece2',
        'text-background-padding': '2px',
        'text-background-shape': 'roundrectangle' as any,
        'overlay-opacity': 0,
        'z-index': 1,
        'transition-property': 'opacity, line-color' as any,
        'transition-duration': '0.15s' as any,
      },
    },

    // ── Dimmed node (unfocused/hover) ──────────────────────────────────────
    {
      selector: 'node.dimmed',
      style: {
        'background-opacity': 0.10,
        'border-opacity': 0.06,
        color: 'rgba(0,0,0,0)',
        'z-index': 0,
      } as any,
    },

    // ── Dimmed edge (unfocused/hover) ──────────────────────────────────────
    {
      selector: 'edge.dimmed',
      style: {
        opacity: 0.04,
        'z-index': 0,
      } as any,
    },

    // ── Highlighted node (hover neighbourhood) ─────────────────────────────
    {
      selector: 'node.highlighted',
      style: {
        'background-opacity': 1.0,
        'border-width': 2.5,
        'border-opacity': 0.9,
        color: labelColor,
        'z-index': 20,
      } as any,
    },

    // ── Highlighted edge (hover neighbourhood) ─────────────────────────────
    {
      selector: 'edge.highlighted',
      style: {
        opacity: isDark ? 0.9 : 0.95,
        'line-color': edgeLineColor,
        'target-arrow-color': edgeLineColor,
        color: edgeLabelColor,
        'z-index': 15,
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
