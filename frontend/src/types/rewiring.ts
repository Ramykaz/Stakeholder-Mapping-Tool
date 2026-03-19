// Type definitions for rewiring UI flows, navigation, and workspace context
// This file is the authoritative source for all rewired UI types

export type WorkspaceId = string;

export interface WorkspaceContext {
  id: WorkspaceId;
  name: string;
  status: 'active' | 'archived';
  // Add more fields as needed for context persistence
}

export type NavigationRoute =
  | 'upload'
  | 'graph'
  | 'entities'
  | 'reasoning'
  | 'projects'
  | 'setup'
  | 'documents'
  | 'map'
  | 'entityDetail';

export interface NavigationItem {
  label: string;
  route: NavigationRoute;
  icon?: string;
  requiresAuth?: boolean;
}

export interface EntityStatus {
  type: string;
  label: string;
  color: string;
}

// Extend as needed for rewired UI contracts
