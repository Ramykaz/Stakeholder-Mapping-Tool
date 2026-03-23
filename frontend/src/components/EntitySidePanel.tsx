import React from 'react';
import { ContextualSummaryResponse, GlobalEntityProfile } from '@/lib/api';
import { CytoscapeNode } from '@/types';

interface EntitySidePanelProps {
  node: CytoscapeNode;
  profile: GlobalEntityProfile | null;
  loadingProfile: boolean;
  summary: ContextualSummaryResponse | null;
  loadingSummary: boolean;
  summaryEnabled: boolean;
  canGoBack?: boolean;
  onBack?: () => void;
  onClose: () => void;
  onSelectRelated: (entityId: string) => void;
  onGenerateSummary: (refresh?: boolean) => void;
}

const TYPE_COLORS: Record<string, string> = {
  PERSON:       '#2ec4a5',
  ORGANIZATION: '#3d6fff',
  GOVERNMENT:   '#3d6fff',
  LOCATION:     '#f5a623',
  ROLE:         '#7b8299',
  EVENT:        '#9b6ef3',
  PROJECT:      '#9b6ef3',
  POLICY:       '#9b6ef3',
  CONCEPT:      '#f0614a',
  THEME:        '#f0614a',
};

export default function EntitySidePanel({
  node,
  profile,
  loadingProfile,
  summary,
  loadingSummary,
  summaryEnabled,
  canGoBack = false,
  onBack,
  onClose,
  onSelectRelated,
  onGenerateSummary,
}: EntitySidePanelProps) {
  const confidencePercent = Math.round((node.data.confidence || 0) * 100);
  const typeColor = TYPE_COLORS[node.data.entity_type] || '#7b8299';

  return (
    <div style={{
      width: 300,
      flexShrink: 0,
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Node Detail
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {canGoBack && onBack && (
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, borderRadius: 4 }}
              title="Back"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, borderRadius: 4 }}
            title="Close panel"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>

          {/* Name */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Name</div>
            <div style={{ fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{node.label}</div>
          </div>

          {/* Type */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Type</div>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 10px', borderRadius: 20,
              fontSize: 11, fontFamily: 'var(--mono)',
              background: `${typeColor}22`,
              color: typeColor,
              border: `1px solid ${typeColor}44`,
            }}>
              {node.data.entity_type}
            </span>
          </div>

          {/* Confidence */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Confidence</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${confidencePercent}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', minWidth: 32 }}>{confidencePercent}%</span>
            </div>
          </div>

          {/* Aliases */}
          {profile?.aliases && profile.aliases.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Aliases</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {profile.aliases.map((alias, i) => (
                  <span key={i} style={{
                    padding: '2px 8px', borderRadius: 4,
                    background: 'var(--bg3)', color: 'var(--text2)', fontSize: 11,
                    border: '1px solid var(--border)',
                  }}>
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contextual summary */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>Summary</div>
              {summaryEnabled && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onGenerateSummary(false)}
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    disabled={loadingSummary}
                  >
                    {loadingSummary ? '…' : 'Generate'}
                  </button>
                  <button
                    onClick={() => onGenerateSummary(true)}
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    disabled={loadingSummary}
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>
            {!summaryEnabled ? (
              <p style={{ color: 'var(--text3)', fontSize: 12 }}>Summary available in project context.</p>
            ) : summary?.summary ? (
              <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.6 }}>{summary.summary}</p>
            ) : summary?.fallback_message ? (
              <p style={{ color: 'var(--amber)', fontSize: 12 }}>{summary.fallback_message}</p>
            ) : (
              <p style={{ color: 'var(--text3)', fontSize: 12 }}>No summary yet.</p>
            )}
          </div>

          {/* Related projects */}
          {profile && (
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Projects</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(profile.projects || []).map((project) => (
                  <span key={project.id} style={{
                    padding: '2px 8px', borderRadius: 4,
                    background: 'var(--bg3)', color: 'var(--text2)', fontSize: 11,
                    border: '1px solid var(--border)',
                  }}>
                    {project.name}
                  </span>
                ))}
                {!(profile.projects || []).length && (
                  <span style={{ color: 'var(--text3)', fontSize: 12 }}>No projects</span>
                )}
              </div>
            </div>
          )}

          {/* Relationships */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Relationships</div>
            {loadingProfile ? (
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>Loading…</span>
            ) : (profile?.relationships || []).length === 0 ? (
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>No relationships</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {(profile?.relationships || []).slice(0, 10).map((rel) => (
                  <button
                    key={rel.relation_id}
                    onClick={() => onSelectRelated(rel.target_entity_id)}
                    style={{
                      width: '100%', textAlign: 'left', fontSize: 11,
                      padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                      background: 'var(--bg3)', border: '1px solid var(--border)',
                      color: 'var(--text2)', display: 'flex', gap: 4,
                    }}
                  >
                    <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{rel.relation_type}</span>
                    <span style={{ color: 'var(--text3)' }}>→ {rel.target_entity_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
