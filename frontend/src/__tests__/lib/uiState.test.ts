/**
 * Unit tests for src/lib/uiState.ts
 * Covers getAsyncBadge, formatFileSize, formatRelativeTime, getActiveTheme, DEFAULT_FILTER_STATE
 */

import {
  getAsyncBadge,
  formatFileSize,
  formatRelativeTime,
  getActiveTheme,
  DEFAULT_FILTER_STATE,
} from '@/lib/uiState';

// ---------------------------------------------------------------------------
// getAsyncBadge
// ---------------------------------------------------------------------------
describe('getAsyncBadge', () => {
  test('idle → badge-draft / Idle', () => {
    const badge = getAsyncBadge('idle');
    expect(badge.label).toBe('Idle');
    expect(badge.cssClass).toBe('badge-draft');
  });

  test('loading → badge-proc / Loading', () => {
    const badge = getAsyncBadge('loading');
    expect(badge.label).toBe('Loading');
    expect(badge.cssClass).toBe('badge-proc');
  });

  test('success → badge-live / Ready', () => {
    const badge = getAsyncBadge('success');
    expect(badge.label).toBe('Ready');
    expect(badge.cssClass).toBe('badge-live');
  });

  test('error → badge-error / Error', () => {
    const badge = getAsyncBadge('error');
    expect(badge.label).toBe('Error');
    expect(badge.cssClass).toBe('badge-error');
  });
});

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------
describe('formatFileSize', () => {
  test('0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  test('bytes under 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  test('kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  test('megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });

  test('fractional KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  test('fractional MB', () => {
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------
describe('formatRelativeTime', () => {
  const now = Date.now();

  test('< 1 minute → "just now"', () => {
    const iso = new Date(now - 30_000).toISOString();
    expect(formatRelativeTime(iso)).toBe('just now');
  });

  test('between 1 and 59 minutes → Xm ago', () => {
    const iso = new Date(now - 5 * 60_000).toISOString();
    expect(formatRelativeTime(iso)).toBe('5m ago');
  });

  test('between 1 and 23 hours → Xh ago', () => {
    const iso = new Date(now - 3 * 3_600_000).toISOString();
    expect(formatRelativeTime(iso)).toBe('3h ago');
  });

  test('between 1 and 29 days → Xd ago', () => {
    const iso = new Date(now - 5 * 86_400_000).toISOString();
    expect(formatRelativeTime(iso)).toBe('5d ago');
  });

  test('≥ 30 days → formatted date string', () => {
    const iso = new Date(now - 35 * 86_400_000).toISOString();
    const result = formatRelativeTime(iso);
    // Should be a date string like "15 Mar" not "Xd ago"
    expect(result).not.toMatch(/d ago/);
  });

  test('invalid iso returns some string without throwing', () => {
    // The function should not throw; the exact fallback value may vary
    expect(() => formatRelativeTime('not-a-date')).not.toThrow();
    expect(typeof formatRelativeTime('not-a-date')).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// getActiveTheme
// ---------------------------------------------------------------------------
describe('getActiveTheme', () => {
  test('returns dark when data-theme is not set', () => {
    document.documentElement.removeAttribute('data-theme');
    expect(getActiveTheme()).toBe('dark');
  });

  test('returns light when data-theme="light"', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    expect(getActiveTheme()).toBe('light');
    document.documentElement.removeAttribute('data-theme');
  });

  test('returns dark for unrecognized data-theme value', () => {
    document.documentElement.setAttribute('data-theme', 'ocean');
    expect(getActiveTheme()).toBe('dark');
    document.documentElement.removeAttribute('data-theme');
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_FILTER_STATE
// ---------------------------------------------------------------------------
describe('DEFAULT_FILTER_STATE', () => {
  test('entityTypes is empty array', () => {
    expect(DEFAULT_FILTER_STATE.entityTypes).toEqual([]);
  });

  test('confidenceMin is 0', () => {
    expect(DEFAULT_FILTER_STATE.confidenceMin).toBe(0);
  });

  test('degreeMin is 0', () => {
    expect(DEFAULT_FILTER_STATE.degreeMin).toBe(0);
  });
});
