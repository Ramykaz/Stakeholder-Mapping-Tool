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

const BADGE_STYLES: Record<string, string> = {
  PERSON: 'badge-person',
  ORGANIZATION: 'badge-organization',
  LOCATION: 'badge-location',
  ROLE: 'badge-role',
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

  return (
    <div className="w-80 flex-shrink-0 animate-slide-up">
      <div className="card sticky top-20 !p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Node Detail</h3>
          <div className="flex items-center gap-1">
            {canGoBack && onBack && (
              <button
                onClick={onBack}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Back"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Close panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Name</p>
            <p className="font-semibold text-navy-700">{node.label}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Type</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${BADGE_STYLES[node.data.entity_type] || ''}`}>
              {node.data.entity_type}
            </span>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-0.5">Confidence</p>
            <p className="text-sm font-semibold text-navy-700 tabular-nums">{confidencePercent}%</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-0.5">Aliases</p>
            <p className="text-gray-700">{profile?.aliases?.length ? profile.aliases.join(', ') : 'No aliases'}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-400">Contextual summary</p>
              {summaryEnabled && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onGenerateSummary(false)}
                    className="btn-ghost text-xs !px-2 !py-1"
                    disabled={loadingSummary}
                  >
                    {loadingSummary ? 'Loading…' : 'Generate'}
                  </button>
                  <button
                    onClick={() => onGenerateSummary(true)}
                    className="btn-ghost text-xs !px-2 !py-1"
                    disabled={loadingSummary}
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>
            {!summaryEnabled ? (
              <p className="text-gray-500 text-xs">Summary generation is available in project context.</p>
            ) : summary?.summary ? (
              <p className="text-gray-700 leading-relaxed">{summary.summary}</p>
            ) : summary?.fallback_message ? (
              <p className="text-amber-700 text-xs">{summary.fallback_message}</p>
            ) : (
              <p className="text-gray-500 text-xs">No summary generated yet.</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Related projects</p>
            <div className="flex flex-wrap gap-1.5">
              {(profile?.projects || []).map((project) => (
                <span key={project.id} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                  {project.name}
                </span>
              ))}
              {!loadingProfile && !(profile?.projects || []).length && (
                <span className="text-gray-500 text-xs">No memberships</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Relationships</p>
            <div className="max-h-40 overflow-auto space-y-1 pr-1">
              {(profile?.relationships || []).slice(0, 10).map((rel) => (
                <button
                  key={rel.relation_id}
                  onClick={() => onSelectRelated(rel.target_entity_id)}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100"
                >
                  <span className="font-medium text-navy-700">{rel.relation_type}</span>
                  <span className="text-gray-500"> → {rel.target_entity_id}</span>
                </button>
              ))}
              {!loadingProfile && !(profile?.relationships || []).length && (
                <p className="text-gray-500 text-xs">No relationships in scope</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
