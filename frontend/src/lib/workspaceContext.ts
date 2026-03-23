// Workspace context persistence helper for rewired UI
// Handles saving and restoring active workspace context across navigation and reloads
// Includes stale-response guards so switching projects doesn't surface stale data

import { WorkspaceContext, WorkspaceId } from '../types/rewiring';

const STORAGE_KEY = 'activeWorkspaceContext';
/** Max age in ms before a stored context is considered stale (30 minutes) */
const MAX_AGE_MS = 30 * 60 * 1000;

interface PersistedContext extends WorkspaceContext {
  _savedAt: number;
}

export function saveWorkspaceContext(context: WorkspaceContext) {
  const persisted: PersistedContext = { ...context, _savedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    /* storage quota or SSR — ignore */
  }
}

export function loadWorkspaceContext(): WorkspaceContext | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const persisted = JSON.parse(raw) as PersistedContext;
    if (Date.now() - (persisted._savedAt || 0) > MAX_AGE_MS) {
      clearWorkspaceContext();
      return null;
    }
    const { _savedAt: _unused, ...ctx } = persisted;
    return ctx as WorkspaceContext;
  } catch {
    return null;
  }
}

export function clearWorkspaceContext() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getActiveWorkspaceId(): WorkspaceId | null {
  const ctx = loadWorkspaceContext();
  return ctx ? ctx.id : null;
}

/**
 * Guard for stale workspace responses.
 * Returns true when the given workspaceId matches the currently active context,
 * meaning the async response is still relevant. If the user switched projects
 * mid-flight, returns false so the caller can discard the stale result.
 */
export function isResponseRelevant(workspaceId: WorkspaceId): boolean {
  const active = getActiveWorkspaceId();
  return active === null || active === workspaceId;
}
