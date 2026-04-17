/**
 * Unit tests for src/lib/cytoscapeStyle.ts
 * Covers buildCytoscapeStylesheet, TYPE_PALETTE, getColor
 */

import {
  buildCytoscapeStylesheet,
  TYPE_PALETTE,
  cytoscapeStylesheet,
  ENTITY_COLORS,
  getColor,
} from '@/lib/cytoscapeStyle';

// ---------------------------------------------------------------------------
// TYPE_PALETTE
// ---------------------------------------------------------------------------
describe('TYPE_PALETTE', () => {
  test('contains PERSON entry', () => {
    expect(TYPE_PALETTE['PERSON']).toBeDefined();
    expect(TYPE_PALETTE['PERSON']).toMatch(/^#/);
  });

  test('contains ORGANIZATION entry', () => {
    expect(TYPE_PALETTE['ORGANIZATION']).toBeDefined();
  });

  test('all values are hex color strings', () => {
    for (const [, color] of Object.entries(TYPE_PALETTE)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// buildCytoscapeStylesheet
// ---------------------------------------------------------------------------
describe('buildCytoscapeStylesheet', () => {
  test('returns an array', () => {
    expect(Array.isArray(buildCytoscapeStylesheet('dark'))).toBe(true);
  });

  test('array has at least 5 entries (base node, edge, per-type selectors, etc.)', () => {
    const styles = buildCytoscapeStylesheet('dark');
    expect(styles.length).toBeGreaterThan(5);
  });

  test('includes base node selector', () => {
    const styles = buildCytoscapeStylesheet('dark');
    expect(styles.some((s) => s.selector === 'node')).toBe(true);
  });

  test('includes edge selector', () => {
    const styles = buildCytoscapeStylesheet('dark');
    expect(styles.some((s) => s.selector === 'edge')).toBe(true);
  });

  test('dark theme uses dark label color', () => {
    const styles = buildCytoscapeStylesheet('dark');
    const nodeStyle = styles.find((s) => s.selector === 'node')!.style as any;
    expect(nodeStyle.color).toBe('#c8cad8');
  });

  test('light theme uses light label color', () => {
    const styles = buildCytoscapeStylesheet('light');
    const nodeStyle = styles.find((s) => s.selector === 'light')?.style
      ?? styles.find((s) => s.selector === 'node')!.style as any;
    // Light theme should have a different label color than dark
    const darkNodeStyle = buildCytoscapeStylesheet('dark').find((s) => s.selector === 'node')!.style as any;
    const lightNodeStyle = buildCytoscapeStylesheet('light').find((s) => s.selector === 'node')!.style as any;
    expect(lightNodeStyle.color).not.toBe(darkNodeStyle.color);
  });

  test('per-type selectors use TYPE_PALETTE colors', () => {
    const styles = buildCytoscapeStylesheet('dark');
    const personSelector = styles.find((s) => s.selector === 'node[entity_type="PERSON"]');
    expect(personSelector).toBeDefined();
    expect((personSelector!.style as any)['background-color']).toBe(TYPE_PALETTE['PERSON']);
  });

  test('default export cytoscapeStylesheet is for dark theme', () => {
    expect(Array.isArray(cytoscapeStylesheet)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getColor / ENTITY_COLORS
// ---------------------------------------------------------------------------
describe('getColor', () => {
  test('known entity type returns typed color object', () => {
    const color = getColor('PERSON');
    expect(color).toHaveProperty('bg');
    expect(color).toHaveProperty('border');
    expect(color).toHaveProperty('text');
  });

  test('unknown entity type returns DEFAULT_COLOR object', () => {
    const color = getColor('UNKNOWN_TYPE');
    expect(color).toHaveProperty('bg');
    expect(color).toHaveProperty('border');
  });

  test('ENTITY_COLORS has entry for each TYPE_PALETTE key', () => {
    for (const key of Object.keys(TYPE_PALETTE)) {
      expect(ENTITY_COLORS[key]).toBeDefined();
    }
  });
});
