// Shared async-state and badge adapter utilities for rewired UI

export type AsyncState = 'idle' | 'loading' | 'success' | 'error';

export interface BadgeDescriptor {
  label: string;
  cssClass: string;
}

export function getAsyncBadge(state: AsyncState): BadgeDescriptor {
  switch (state) {
    case 'loading': return { label: 'Loading',  cssClass: 'badge-proc'  };
    case 'success': return { label: 'Ready',    cssClass: 'badge-live'  };
    case 'error':   return { label: 'Error',    cssClass: 'badge-error' };
    default:        return { label: 'Idle',     cssClass: 'badge-draft' };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)    return 'just now';
    if (mins < 60)   return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days < 30)   return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}
