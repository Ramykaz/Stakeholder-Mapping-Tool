import React from 'react';
import { useRouter } from 'next/router';

interface StakeholderPriority {
  rank: number | null;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  priority_reason: string;
  ask_request: string;
}

interface PersonaRef {
  archetype_label: string;
  persona_name: string;
}

interface ReportSectionRef {
  section_number: number;
  report_chapter_title: string;
}

interface EntityStakeholderAnalysisProps {
  projectId: string;
  stakeholderPriority: StakeholderPriority | null;
  persona: PersonaRef | null;
  appearsInReportSections: ReportSectionRef[];
  hasStakeholderTable: boolean;
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  High: { bg: '#007A8720', text: '#007A87' },
  Medium: { bg: '#F59E0B20', text: '#B45309' },
  Low: { bg: '#E5E7EB', text: '#6B7280' },
};

export default function EntityStakeholderAnalysis({
  projectId,
  stakeholderPriority,
  persona,
  appearsInReportSections,
  hasStakeholderTable,
}: EntityStakeholderAnalysisProps) {
  const router = useRouter();

  const hasAnyData = stakeholderPriority || persona || appearsInReportSections.length > 0;
  const noDataAtAll = !hasAnyData && !hasStakeholderTable;

  if (!hasAnyData && hasStakeholderTable) {
    return (
      <>
        <hr className="border-[var(--border)] my-4" />
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">
          Stakeholder Analysis
        </p>
        <p className="text-sm text-[var(--muted)]">Not ranked in the top stakeholders.</p>
      </>
    );
  }

  if (noDataAtAll) {
    return (
      <>
        <hr className="border-[var(--border)] my-4" />
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">
          Stakeholder Analysis
        </p>
        <button
          onClick={() => router.push(`/projects/${projectId}/stakeholders`)}
          className="text-sm underline"
          style={{ color: '#007A87' }}
        >
          Generate stakeholder table to see priority analysis →
        </button>
      </>
    );
  }

  if (!hasAnyData) return null;

  const priorityStyle = stakeholderPriority
    ? PRIORITY_STYLES[stakeholderPriority.priority] || PRIORITY_STYLES.Low
    : null;

  return (
    <>
      <hr className="border-[var(--border)] my-4" />
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
        Stakeholder Analysis
      </p>

      {stakeholderPriority && priorityStyle && (
        <div className="space-y-3 mb-3">
          {/* Priority badge + rank */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
              style={{ background: priorityStyle.bg, color: priorityStyle.text }}
            >
              {stakeholderPriority.priority}
            </span>
            <span className="text-sm text-[var(--text)]">{stakeholderPriority.category}</span>
            {stakeholderPriority.rank && (
              <span className="text-xs font-mono text-[var(--muted)]">
                #{stakeholderPriority.rank}
              </span>
            )}
          </div>

          {/* Priority reason */}
          {stakeholderPriority.priority_reason && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
                Why this priority:
              </p>
              <p className="text-sm text-[var(--text)] leading-relaxed">
                {stakeholderPriority.priority_reason}
              </p>
            </div>
          )}

          {/* Ask request */}
          {stakeholderPriority.ask_request && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
                Recommended ask:
              </p>
              <p className="text-sm text-[var(--text)] leading-relaxed">
                {stakeholderPriority.ask_request}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Report sections */}
      {appearsInReportSections.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">
            Appears in report:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {appearsInReportSections.map((s) => (
              <button
                key={s.section_number}
                onClick={() =>
                  router.push(`/projects/${projectId}/report#section-${s.section_number}`)
                }
                className="text-xs px-2 py-0.5 rounded font-medium transition-opacity hover:opacity-80"
                style={{ background: '#007A8720', color: '#007A87' }}
              >
                §{s.section_number} {s.report_chapter_title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Persona */}
      {persona && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
            Representative archetype:
          </p>
          <p className="text-sm text-[var(--text)]">
            <em>{persona.archetype_label}</em> —{' '}
            <button
              onClick={() =>
                router.push(`/projects/${projectId}/report#personas`)
              }
              className="underline"
              style={{ color: '#007A87' }}
            >
              {persona.persona_name}
            </button>
          </p>
        </div>
      )}
    </>
  );
}
