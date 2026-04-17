/**
 * Unit tests for src/lib/entityTypes.ts
 * Covers ENTITY_TYPE_MAP, getStatusBadgeClass, getEntityColor
 */

import { ENTITY_TYPE_MAP, getStatusBadgeClass, getEntityColor } from '@/lib/entityTypes';

// ---------------------------------------------------------------------------
// ENTITY_TYPE_MAP
// ---------------------------------------------------------------------------
describe('ENTITY_TYPE_MAP', () => {
  test('contains Organization entry with color and shape', () => {
    expect(ENTITY_TYPE_MAP['Organization']).toMatchObject({
      color: expect.any(String),
      shape: expect.any(String),
    });
  });

  test('Person entry is present', () => {
    expect(ENTITY_TYPE_MAP['Person']).toBeDefined();
  });

  test('Government entry is present', () => {
    expect(ENTITY_TYPE_MAP['Government']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getStatusBadgeClass
// ---------------------------------------------------------------------------
describe('getStatusBadgeClass', () => {
  test.each(['ready', 'active', 'processed', 'complete'])(
    '%s → badge-live',
    (status) => {
      expect(getStatusBadgeClass(status)).toBe('badge-live');
    },
  );

  test.each(['processing', 'queued', 'pending', 'stale', 'paused_rate_limited'])(
    '%s → badge-proc',
    (status) => {
      expect(getStatusBadgeClass(status)).toBe('badge-proc');
    },
  );

  test.each(['error', 'failed'])('%s → badge-error', (status) => {
    expect(getStatusBadgeClass(status)).toBe('badge-error');
  });

  test('unknown status → badge-draft', () => {
    expect(getStatusBadgeClass('unknown_status')).toBe('badge-draft');
  });

  test('empty string → badge-draft', () => {
    expect(getStatusBadgeClass('')).toBe('badge-draft');
  });

  test('case-insensitive: READY → badge-live', () => {
    expect(getStatusBadgeClass('READY')).toBe('badge-live');
  });

  test('trims whitespace', () => {
    expect(getStatusBadgeClass('  active  ')).toBe('badge-live');
  });
});

// ---------------------------------------------------------------------------
// getEntityColor
// ---------------------------------------------------------------------------
describe('getEntityColor', () => {
  test('PERSON → Person color', () => {
    expect(getEntityColor('PERSON')).toBe(ENTITY_TYPE_MAP['Person'].color);
  });

  test('ORGANIZATION → Organization color', () => {
    expect(getEntityColor('ORGANIZATION')).toBe(ENTITY_TYPE_MAP['Organization'].color);
  });

  test('GOVERNMENT → Government color', () => {
    expect(getEntityColor('GOVERNMENT')).toBe(ENTITY_TYPE_MAP['Government'].color);
  });

  test('CONCEPT → Concept/Theme color', () => {
    expect(getEntityColor('CONCEPT')).toBe(ENTITY_TYPE_MAP['Concept/Theme'].color);
  });

  test('THEME → Concept/Theme color', () => {
    expect(getEntityColor('THEME')).toBe(ENTITY_TYPE_MAP['Concept/Theme'].color);
  });

  test('INITIATIVE → Policy/Initiative color', () => {
    expect(getEntityColor('INITIATIVE')).toBe(ENTITY_TYPE_MAP['Policy/Initiative'].color);
  });

  test('unknown type → fallback grey', () => {
    const color = getEntityColor('COMPLETELY_UNKNOWN');
    expect(color).toBe('#7b8299');
  });

  test('empty string → fallback grey', () => {
    expect(getEntityColor('')).toBe('#7b8299');
  });
});
