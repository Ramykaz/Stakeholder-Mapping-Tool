/**
 * Demo mode must never 404 or silently fail for any interaction reachable
 * from the map page or entity detail page — these tests pin down the exact
 * URL shapes api.ts's real functions send, so a future refactor that changes
 * either side without the other breaks loudly instead of silently reaching
 * the real backend with a fake "e1" id.
 */
import { isDemoUrl, matchDemoRoute, DEMO_PROJECT_ID } from '@/lib/demoData';

describe('isDemoUrl', () => {
  test.each([
    '/api/v1/projects/',
    '/api/v1/projects/demo/',
    '/api/v1/projects/demo/graph/',
    '/api/v1/projects/demo/query/',
    '/api/v1/projects/demo/export/entities.csv',
    '/api/v1/smq/template/',
    '/api/v1/admin/entity-labels/',
    '/api/v1/entities/e1/profile/',
    '/api/v1/entities/e1/summary/',
    '/api/v1/entities/e1/flag/',
    '/api/v1/entities/e1/timeline/',
  ])('matches %s', (url) => {
    expect(isDemoUrl(url)).toBe(true);
  });

  test('does not match an unrelated real-project entity URL', () => {
    expect(isDemoUrl('/api/v1/projects/real-proj-123/documents/')).toBe(false);
  });
});

describe('matchDemoRoute — node click / profile', () => {
  test('GET entity profile returns a profile with relationships', () => {
    const result = matchDemoRoute('get', '/api/v1/entities/e1/profile/');
    expect(result).toBeDefined();
    const data = result!.data as any;
    expect(data.canonical_name).toBe('UNDP Kenya Country Office');
    expect(Array.isArray(data.relationships)).toBe(true);
    expect(data.relationships.length).toBeGreaterThan(0);
  });
});

describe('matchDemoRoute — AI summary generation', () => {
  test('POST summary returns non-empty text for a known entity', () => {
    const result = matchDemoRoute('post', '/api/v1/entities/e1/summary/', { project_id: DEMO_PROJECT_ID, refresh: false });
    const data = result!.data as any;
    expect(typeof data.summary).toBe('string');
    expect(data.summary.length).toBeGreaterThan(20);
  });

  test('POST summary falls back to a generated description for an entity with no bespoke copy', () => {
    const result = matchDemoRoute('post', '/api/v1/entities/e14/summary/', { project_id: DEMO_PROJECT_ID, refresh: false });
    const data = result!.data as any;
    expect(typeof data.summary).toBe('string');
    expect(data.summary.length).toBeGreaterThan(10);
  });
});

describe('matchDemoRoute — graph search', () => {
  test('a name match highlights the right entity id', () => {
    const result = matchDemoRoute('post', '/api/v1/projects/demo/query/', { query: 'Kisumu' });
    const data = result!.data as any;
    expect(data.is_nl_query).toBe(true);
    expect(data.entity_ids.length).toBeGreaterThan(0);
    expect(data.answer).toMatch(/Kisumu/i);
  });

  test('no match still returns a usable answer instead of breaking the UI', () => {
    const result = matchDemoRoute('post', '/api/v1/projects/demo/query/', { query: 'zzz-no-such-stakeholder' });
    const data = result!.data as any;
    expect(data.entity_ids).toEqual([]);
    expect(typeof data.answer).toBe('string');
  });
});

describe('matchDemoRoute — flag and timeline', () => {
  test('flag echoes the requested state', () => {
    const result = matchDemoRoute('post', '/api/v1/entities/e9/flag/', { is_flagged: true });
    expect((result!.data as any).is_flagged).toBe(true);
  });

  test('timeline returns at least one entry', () => {
    const result = matchDemoRoute('get', '/api/v1/entities/e9/timeline/');
    const data = result!.data as any;
    expect(data.timeline.length).toBeGreaterThan(0);
    expect(data.timeline[0].document_name).toBeTruthy();
  });
});

describe('matchDemoRoute — CSV exports', () => {
  test('entities export is a real CSV, not the generic simulated-action object', () => {
    const result = matchDemoRoute('get', '/api/v1/projects/demo/export/entities.csv');
    expect(typeof result!.data).toBe('string');
    expect(result!.data as string).toContain('canonical_name');
    expect(result!.headers?.['content-type']).toBe('text/csv');
  });

  test('relations export is a real CSV', () => {
    const result = matchDemoRoute('get', '/api/v1/projects/demo/export/relations.csv');
    expect(typeof result!.data).toBe('string');
    expect(result!.data as string).toContain('relation_type');
  });
});

describe('matchDemoRoute — generic fallback', () => {
  test('unrecognized demo-scoped mutation still returns something instead of undefined', () => {
    const result = matchDemoRoute('post', '/api/v1/projects/demo/some-future-endpoint/');
    expect(result).toBeDefined();
  });
});
