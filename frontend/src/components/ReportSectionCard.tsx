import React from 'react';
import { ReportSectionResponse } from '@/lib/api';

interface ReportSectionCardProps {
  section: ReportSectionResponse;
  onRegenerate: (sectionId: string) => void;
  busy?: boolean;
}

function statusLabel(status: ReportSectionResponse['status']) {
  if (status === 'pending') return 'Pending';
  if (status === 'generating') return 'Generating';
  if (status === 'done') return 'Done';
  return 'Error';
}

export default function ReportSectionCard({ section, onRegenerate, busy = false }: ReportSectionCardProps) {
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-[var(--serif)] text-lg text-[var(--text)]">
          {section.section_number}. {section.section_title}
        </h3>
        <span className="text-xs text-[var(--text2)]">{statusLabel(section.status)}</span>
      </div>

      {section.status === 'done' && section.generated_text ? (
        <p className="text-sm text-[var(--text2)] whitespace-pre-wrap">{section.generated_text}</p>
      ) : section.status === 'error' ? (
        <p className="text-sm text-[var(--coral,#f0614a)]">{section.error_message || 'Generation failed.'}</p>
      ) : (
        <p className="text-sm text-[var(--text3)]">Section not generated yet.</p>
      )}

      {section.citations?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-[var(--text2)]">Citations</p>
          {section.citations.map((citation, idx) => (
            <div key={`${citation.chunk_id}-${idx}`} className="text-xs text-[var(--text3)]">
              [{citation.doc_name}] {citation.snippet}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          className="btn-ghost"
          disabled={busy || section.status === 'generating'}
          onClick={() => onRegenerate(section.section_id)}
        >
          Regenerate
        </button>
      </div>
    </div>
  );
}
