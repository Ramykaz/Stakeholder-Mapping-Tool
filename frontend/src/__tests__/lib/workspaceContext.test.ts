/**
 * Unit tests for src/lib/workspaceContext.ts
 * Covers save, load, clear, getActiveWorkspaceId, isResponseRelevant
 */

import {
  saveWorkspaceContext,
  loadWorkspaceContext,
  clearWorkspaceContext,
  getActiveWorkspaceId,
  isResponseRelevant,
} from '@/lib/workspaceContext';

const mockContext = { id: 'ws-1', name: 'Test Project', status: 'active' as const };

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('saveWorkspaceContext / loadWorkspaceContext', () => {
  test('save then load returns the same context', () => {
    saveWorkspaceContext(mockContext);
    const loaded = loadWorkspaceContext();
    expect(loaded).toEqual(mockContext);
  });

  test('load returns null when nothing saved', () => {
    expect(loadWorkspaceContext()).toBeNull();
  });

  test('loaded context does not include internal _savedAt key', () => {
    saveWorkspaceContext(mockContext);
    const loaded = loadWorkspaceContext() as any;
    expect(loaded._savedAt).toBeUndefined();
  });

  test('stale context (>30 min) returns null and clears storage', () => {
    saveWorkspaceContext(mockContext);
    // Advance time by 31 minutes
    jest.advanceTimersByTime(31 * 60 * 1000);
    const loaded = loadWorkspaceContext();
    expect(loaded).toBeNull();
    expect(localStorage.getItem('activeWorkspaceContext')).toBeNull();
  });

  test('fresh context within 30 minutes is still returned', () => {
    saveWorkspaceContext(mockContext);
    jest.advanceTimersByTime(29 * 60 * 1000);
    expect(loadWorkspaceContext()).toEqual(mockContext);
  });
});

describe('clearWorkspaceContext', () => {
  test('removes saved context', () => {
    saveWorkspaceContext(mockContext);
    clearWorkspaceContext();
    expect(loadWorkspaceContext()).toBeNull();
  });

  test('does not throw when nothing is stored', () => {
    expect(() => clearWorkspaceContext()).not.toThrow();
  });
});

describe('getActiveWorkspaceId', () => {
  test('returns workspace id from stored context', () => {
    saveWorkspaceContext(mockContext);
    expect(getActiveWorkspaceId()).toBe('ws-1');
  });

  test('returns null when no context stored', () => {
    expect(getActiveWorkspaceId()).toBeNull();
  });
});

describe('isResponseRelevant', () => {
  test('returns true when workspace matches active context', () => {
    saveWorkspaceContext(mockContext);
    expect(isResponseRelevant('ws-1')).toBe(true);
  });

  test('returns false when workspace does not match active context', () => {
    saveWorkspaceContext(mockContext);
    expect(isResponseRelevant('ws-OTHER')).toBe(false);
  });

  test('returns true when no context stored (null active)', () => {
    expect(isResponseRelevant('any-id')).toBe(true);
  });
});
