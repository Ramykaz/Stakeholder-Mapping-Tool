// Shared entity/status mapping constants for rewired UI
// Used for consistent badge, color, shape, and label mapping across the app

export const ENTITY_TYPE_MAP = {
  Organization:        { color: '#3d6fff', shape: 'circle'   },
  Government:          { color: '#3d6fff', shape: 'square'   },
  Person:              { color: '#2ec4a5', shape: 'hexagon'  },
  'Policy/Initiative': { color: '#9b6ef3', shape: 'diamond'  },
  Location:            { color: '#f5a623', shape: 'circle'   },
  Event:               { color: '#9b6ef3', shape: 'diamond'  },
  Project:             { color: '#9b6ef3', shape: 'diamond'  },
  'Concept/Theme':     { color: '#f0614a', shape: 'triangle' },
  Role:                { color: '#7b8299', shape: 'circle'   },
} as const;

export function getStatusBadgeClass(status: string): string {
  const normalized = (status || '').trim().toLowerCase();
  if (['ready', 'active', 'processed', 'complete'].includes(normalized)) return 'badge-live';
  if (['processing', 'queued', 'pending', 'stale', 'paused_rate_limited'].includes(normalized)) return 'badge-proc';
  if (['error', 'failed'].includes(normalized)) return 'badge-error';
  return 'badge-draft';
}

export function getEntityColor(entityType: string): string {
  return (ENTITY_TYPE_MAP as Record<string, { color: string; shape: string }>)[entityType]?.color ?? '#7b8299';
}
