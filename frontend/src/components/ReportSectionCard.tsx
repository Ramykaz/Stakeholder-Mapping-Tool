import React, { useEffect, useState } from 'react';
import { ReportSectionResponse } from '@/lib/api';

interface ReportSectionCardProps {
  section: ReportSectionResponse;
  onRegenerate: (sectionId: string, customInstruction?: string) => void;
  onSaveEdit: (sectionId: string, generatedText: string) => void;
  busy?: boolean;
}

function isRateLimit(msg: string | null | undefined): boolean {
  const m = (msg || '').toLowerCase();
  return m.includes('rate limit') || m.includes('rate_limit');
}

function statusLabel(status: ReportSectionResponse['status']) {
  if (status === 'pending') return 'Pending';
  if (status === 'generating') return 'Generating';
  if (status === 'done') return 'Done';
  if (status === 'stale') return 'Stale';
  return 'Error';
}

export default function ReportSectionCard({ section, onRegenerate, onSaveEdit, busy = false }: ReportSectionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(section.generated_text || '');
  const [customInstruction, setCustomInstruction] = useState('');

  useEffect(() => {
    setDraftText(section.generated_text || '');
  }, [section.generated_text]);

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-[var(--serif)] text-lg text-[var(--text)]">
          {section.section_number}. {section.section_title}
        </h3>
        <span className="text-xs text-[var(--text2)]">{statusLabel(section.status)}</span>
      </div>

      {isEditing ? (
        <textarea
          aria-label={`Edit report section ${section.section_number}`}
          className="input-field min-h-[180px]"
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
        />
      ) : section.status === 'done' && section.generated_text ? (
        <p className="text-sm text-[var(--text2)] whitespace-pre-wrap">{section.generated_text}</p>
      ) : section.status === 'error' ? (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: isRateLimit(section.error_message) ? '#FFFBEB' : 'rgba(240,97,74,0.08)',
          border: `1px solid ${isRateLimit(section.error_message) ? '#F59E0B' : 'rgba(240,97,74,0.3)'}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{isRateLimit(section.error_message) ? '⏳' : '⚠'}</span>
          <p className="text-sm" style={{ color: isRateLimit(section.error_message) ? '#92400E' : 'var(--coral,#f0614a)', margin: 0 }}>
            {section.error_message || 'Generation failed.'}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--text3)]">Section not generated yet.</p>
      )}

      <div className="space-y-1">
        <label className="text-xs text-[var(--text2)]">Refinement instruction (optional)</label>
        <input
          className="input-field"
          value={customInstruction}
          onChange={(event) => setCustomInstruction(event.target.value)}
          placeholder="e.g. focus more on government stakeholders"
        />
      </div>

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
        {isEditing ? (
          <>
            <button
              className="btn-ghost mr-2"
              disabled={busy}
              onClick={() => {
                setIsEditing(false);
                setDraftText(section.generated_text || '');
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary mr-2"
              disabled={busy || !draftText.trim()}
              onClick={() => onSaveEdit(section.section_id, draftText)}
            >
              Save Edit
            </button>
          </>
        ) : (
          <button
            className="btn-ghost mr-2"
            disabled={busy || section.status === 'generating'}
            onClick={() => setIsEditing(true)}
          >
            Edit
          </button>
        )}
        <button
          className="btn-ghost"
          disabled={busy || section.status === 'generating'}
          onClick={() => onRegenerate(section.section_id, customInstruction)}
        >
          Regenerate
        </button>
      </div>
    </div>
  );
}
