// Shared entity/status mapping constants for rewired UI
// Used for consistent badge, color, shape, and label mapping across the app

// Cartographer palette — entity types read like a legend on a survey map:
// brass (person), teal (organization), clay (location), slate (role),
// dusty plum (event/project/policy), forest ink (concept/theme).
export const ENTITY_TYPE_MAP = {
  Organization:        { color: '#5fa89d', shape: 'circle'   },
  Government:          { color: '#5fa89d', shape: 'square'   },
  Person:              { color: '#d9b35c', shape: 'hexagon'  },
  'Policy/Initiative': { color: '#9c7fae', shape: 'diamond'  },
  Location:            { color: '#c97b4a', shape: 'circle'   },
  Event:               { color: '#9c7fae', shape: 'diamond'  },
  Project:             { color: '#9c7fae', shape: 'diamond'  },
  'Concept/Theme':     { color: '#5f8a5a', shape: 'triangle' },
  Role:                { color: '#8a97a6', shape: 'circle'   },
} as const;

export function getStatusBadgeClass(status: string): string {
  const normalized = (status || '').trim().toLowerCase();
  if (['ready', 'active', 'processed', 'complete'].includes(normalized)) return 'badge-live';
  if (['processing', 'queued', 'pending', 'stale', 'paused_rate_limited'].includes(normalized)) return 'badge-proc';
  if (['error', 'failed'].includes(normalized)) return 'badge-error';
  return 'badge-draft';
}

export function getEntityColor(entityType: string): string {
  const normalized = (entityType || '').trim();
  const upper = normalized.toUpperCase();
  const aliasToLabel: Record<string, keyof typeof ENTITY_TYPE_MAP> = {
    PERSON: 'Person',
    ORGANIZATION: 'Organization',
    GOVERNMENT: 'Government',
    LOCATION: 'Location',
    ROLE: 'Role',
    EVENT: 'Event',
    PROJECT: 'Project',
    POLICY: 'Policy/Initiative',
    INITIATIVE: 'Policy/Initiative',
    CONCEPT: 'Concept/Theme',
    THEME: 'Concept/Theme',
  };

  const mapped = aliasToLabel[upper];
  if (mapped) {
    return ENTITY_TYPE_MAP[mapped].color;
  }

  return (ENTITY_TYPE_MAP as Record<string, { color: string; shape: string }>)[normalized]?.color ?? '#8a97a6';
}
