/**
 * Unit tests for src/lib/routes.ts
 * Covers buildRoute and convenience helpers
 */

import {
  buildRoute,
  setupRoute,
  documentsRoute,
  mapRoute,
  entityRoute,
} from '@/lib/routes';

describe('buildRoute', () => {
  test('upload → /upload regardless of workspaceId', () => {
    expect(buildRoute('upload')).toBe('/upload');
    expect(buildRoute('upload', 'ws-1')).toBe('/upload');
  });

  test('projects → /projects regardless of workspaceId', () => {
    expect(buildRoute('projects')).toBe('/projects');
    expect(buildRoute('projects', 'ws-1')).toBe('/projects');
  });

  test('graph without workspaceId → /graph', () => {
    expect(buildRoute('graph')).toBe('/graph');
  });

  test('graph with workspaceId → /projects/{id}/map', () => {
    expect(buildRoute('graph', 'proj-42')).toBe('/projects/proj-42/map');
  });

  test('entities without workspaceId → /entities', () => {
    expect(buildRoute('entities')).toBe('/entities');
  });

  test('entities with workspaceId → /projects/{id}/entities', () => {
    expect(buildRoute('entities', 'proj-1')).toBe('/projects/proj-1/entities');
  });

  test('reasoning without workspaceId → /reasoning', () => {
    expect(buildRoute('reasoning')).toBe('/reasoning');
  });

  test('reasoning with workspaceId → /projects/{id}/workspace', () => {
    expect(buildRoute('reasoning', 'proj-1')).toBe('/projects/proj-1/workspace');
  });

  test('setup without workspaceId → /setup', () => {
    expect(buildRoute('setup')).toBe('/setup');
  });

  test('setup with workspaceId → /projects/{id}/setup', () => {
    expect(buildRoute('setup', 'proj-1')).toBe('/projects/proj-1/setup');
  });

  test('documents without workspaceId → /documents', () => {
    expect(buildRoute('documents')).toBe('/documents');
  });

  test('documents with workspaceId → /projects/{id}/documents', () => {
    expect(buildRoute('documents', 'proj-1')).toBe('/projects/proj-1/documents');
  });

  test('map with workspaceId → /projects/{id}/map', () => {
    expect(buildRoute('map', 'proj-1')).toBe('/projects/proj-1/map');
  });

  test('entityDetail with workspaceId and entityId → full path', () => {
    expect(buildRoute('entityDetail', 'proj-1', { entityId: 'ent-99' }))
      .toBe('/projects/proj-1/entities/ent-99');
  });

  test('entityDetail without workspaceId → /entities/detail', () => {
    expect(buildRoute('entityDetail')).toBe('/entities/detail');
  });

  test('unknown route → /', () => {
    expect(buildRoute('nonexistent' as any)).toBe('/');
  });
});

describe('convenience route helpers', () => {
  test('setupRoute', () => {
    expect(setupRoute('proj-5')).toBe('/projects/proj-5/setup');
  });

  test('documentsRoute', () => {
    expect(documentsRoute('proj-5')).toBe('/projects/proj-5/documents');
  });

  test('mapRoute', () => {
    expect(mapRoute('proj-5')).toBe('/projects/proj-5/map');
  });

  test('entityRoute', () => {
    expect(entityRoute('proj-5', 'ent-10')).toBe('/projects/proj-5/entities/ent-10');
  });
});
