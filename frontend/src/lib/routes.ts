// Shared route builder helpers for rewired UI navigation
// Provides type-safe route construction for all workspace-aware pages

import { NavigationRoute, WorkspaceId } from '../types/rewiring';

export function buildRoute(route: NavigationRoute, workspaceId?: WorkspaceId, params?: Record<string, string | number>): string {
  switch (route) {
    case 'upload':
      return `/upload`;
    case 'graph':
      return workspaceId ? `/projects/${workspaceId}/map` : `/graph`;
    case 'entities':
      return workspaceId ? `/projects/${workspaceId}/entities` : `/entities`;
    case 'reasoning':
      return workspaceId ? `/projects/${workspaceId}/workspace` : `/reasoning`;
    case 'projects':
      return `/projects`;
    case 'setup':
      return workspaceId ? `/projects/${workspaceId}/setup` : `/setup`;
    case 'documents':
      return workspaceId ? `/projects/${workspaceId}/documents` : `/documents`;
    case 'map':
      return workspaceId ? `/projects/${workspaceId}/map` : `/map`;
    case 'entityDetail':
      if (workspaceId && params?.entityId) {
        return `/projects/${workspaceId}/entities/${params.entityId}`;
      }
      return `/entities/detail`;
    default:
      return '/';
  }
}

/** Convenience helpers for the setup → documents → map workflow */
export function setupRoute(projectId: WorkspaceId)     { return `/projects/${projectId}/setup`; }
export function documentsRoute(projectId: WorkspaceId) { return `/projects/${projectId}/documents`; }
export function mapRoute(projectId: WorkspaceId)       { return `/projects/${projectId}/map`; }
export function entityRoute(projectId: WorkspaceId, entityId: string) {
  return `/projects/${projectId}/entities/${entityId}`;
}
