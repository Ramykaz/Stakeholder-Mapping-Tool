import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import ErrorMessage from '@/components/ErrorMessage';
import {
  exportProjectStakeholderPriorityDocx,
  exportProjectStakeholderPriorityPdf,
  exportProjectStakeholderPriorityCsv,
  flagProjectOrphanStakeholders,
  generateProjectStakeholderNotes,
  getProjectStakeholderPriority,
  renderLLMErrorMessage,
  StakeholderNotesGenerationResponse,
  StakeholderPriorityRow,
} from '@/lib/api';

interface Props {
  projectId: string;
  generationState?: StakeholderNotesGenerationResponse | null;
  onGenerationStateChange?: (state: StakeholderNotesGenerationResponse | null) => void;
}

const ENTITY_TYPES = ['PERSON', 'ORGANIZATION', 'GOVERNMENT', 'LOCATION', 'ROLE', 'EVENT', 'PROJECT', 'POLICY', 'CONCEPT', 'THEME'];

export default function StakeholderPriorityTable({ projectId, generationState, onGenerationStateChange }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<StakeholderPriorityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<StakeholderNotesGenerationResponse | null>(null);
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState('');
  const [flaggingOrphans, setFlaggingOrphans] = useState(false);

  const loadRows = useCallback(async (): Promise<StakeholderPriorityRow[]> => {
    if (!projectId) return [];
    setLoading(true);
    try {
      const data = await getProjectStakeholderPriority(projectId, {
        entity_type: entityType || undefined,
        page,
      });
      const results = data.results || [];
      setRows(results);
      setTotalPages(data.total_pages || 1);
      return results;
    } catch {
      setMessage('Failed to load stakeholder priority table.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId, entityType, page]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!generationState) return;
    setGenerationProgress(generationState);
    if (generationState.status !== 'running') {
      setGenerating(false);
    }
  }, [generationState]);

  const typeOptions = useMemo(() => ENTITY_TYPES, []);

  const onGenerateNotes = async (action: 'start' | 'resume' | 'stop' = 'start') => {
    if (!projectId) return;

    if (action === 'stop') {
      setGenerating(true);
      try {
        const result = await generateProjectStakeholderNotes(projectId, { action: 'stop', max_items: 20 });
        setGenerationProgress(result);
        onGenerationStateChange?.(result);
        setMessage(result.message || 'Generation stopped. Existing notes are preserved.');
        await loadRows();
      } catch (error) {
        setMessage(renderLLMErrorMessage(error, 'Stopping engagement note generation'));
      } finally {
        setGenerating(false);
      }
      return;
    }

    setGenerating(true);
    setMessage(action === 'resume' ? 'Resuming engagement notes…' : 'Generating engagement notes… this may take up to 30 seconds.');
    try {
      let nextAction: 'start' | 'resume' = action;
      let attempts = 0;
      let result: StakeholderNotesGenerationResponse | null = null;

      while (attempts < 20) {
        attempts += 1;
        result = await generateProjectStakeholderNotes(projectId, { action: nextAction, max_items: 20 });
        setGenerationProgress(result);
        onGenerationStateChange?.(result);

        if (result.status !== 'running') {
          break;
        }

        setMessage(
          result.message ||
          `Generating engagement notes… (${result.completed_count}/${result.total_target})`
        );
        nextAction = 'resume';
      }

      if (!result) {
        setMessage('Generation failed. Please try again.');
      } else if (result.status === 'paused_rate_limited') {
        setMessage(result.message || 'Generation paused due to provider rate limit. Use Resume to continue.');
      } else if (result.status === 'completed') {
        setMessage(result.message || 'Engagement notes generated.');
      } else if (result.status === 'error') {
        setMessage(result.message || 'Generation failed.');
      } else if (result.status === 'cancelled') {
        setMessage(result.message || 'Generation stopped. Existing notes are preserved.');
      } else if (result.status === 'running') {
        setMessage('Generation is still in progress. Click Continue generation to keep processing.');
      }
    } catch (error) {
      setMessage(renderLLMErrorMessage(error, 'Engagement note generation'));
      setGenerating(false);
      return;
    }

    await loadRows();
    setGenerating(false);
  };

  const onExportCsv = async () => {
    if (!projectId) return;
    try {
      const blob = await exportProjectStakeholderPriorityCsv(projectId, entityType || undefined, 20);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `stakeholder-priority-top20-${projectId}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage('CSV export failed.');
    }
  };

  const onExportPdf = async () => {
    if (!projectId) return;
    try {
      const blob = await exportProjectStakeholderPriorityPdf(projectId, entityType || undefined, 20);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `stakeholder-priority-top20-${projectId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage('PDF export failed.');
    }
  };

  const onExportDocx = async () => {
    if (!projectId) return;
    try {
      const blob = await exportProjectStakeholderPriorityDocx(projectId, entityType || undefined, 20);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `stakeholder-priority-top20-${projectId}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage('DOCX export failed.');
    }
  };

  const onFlagIsolated = async () => {
    if (!projectId) return;
    setFlaggingOrphans(true);
    try {
      const result = await flagProjectOrphanStakeholders(projectId);
      setMessage(result.detail || `Flagged ${result.flagged_count} isolated stakeholder(s).`);
      await loadRows();
    } catch {
      setMessage('Failed to flag isolated stakeholders.');
    } finally {
      setFlaggingOrphans(false);
    }
  };

  const progress = generationProgress;
  const showResume = progress?.status === 'paused_rate_limited' || progress?.status === 'running';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          aria-label="Filter stakeholders by entity type"
          title="Filter stakeholders by entity type"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] text-sm"
        >
          <option value="">All types</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <button className="btn-primary" disabled={generating || loading} onClick={() => void onGenerateNotes()}>
          {generating ? 'Generating…' : 'Generate Engagement Notes'}
        </button>
        {(generating || progress?.status === 'running') ? (
          <button className="btn-ghost" disabled={generating && progress?.status !== 'running'} onClick={() => void onGenerateNotes('stop')}>
            Stop generation
          </button>
        ) : null}
        {showResume ? (
          <button className="btn-ghost" disabled={generating || loading} onClick={() => void onGenerateNotes('resume')}>
            {progress?.status === 'running' ? 'Continue generation' : 'Resume generation'}
          </button>
        ) : null}
        <button className="btn-ghost" disabled={loading} onClick={() => void onExportCsv()}>
          Download Top 20 CSV
        </button>
        <button className="btn-ghost" disabled={loading} onClick={() => void onExportPdf()}>
          Download Top 20 PDF
        </button>
        <button className="btn-ghost" disabled={loading} onClick={() => void onExportDocx()}>
          Download Top 20 DOCX
        </button>
        <button className="btn-ghost" disabled={loading || flaggingOrphans} onClick={() => void onFlagIsolated()}>
          {flaggingOrphans ? 'Flagging…' : 'Flag Isolated'}
        </button>
      </div>

      {progress ? (
        <p className="text-xs text-[var(--text2)]">
          Progress: {progress.completed_count}/{progress.total_target} stakeholders processed.
        </p>
      ) : null}

      {message ? (
        message.toLowerCase().includes('paused') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('error')
          ? <ErrorMessage inline severity={message.toLowerCase().includes('paused') ? 'warning' : 'error'} message={message} />
          : <p className="text-xs text-[var(--teal)]">{message}</p>
      ) : null}

      <div className="overflow-x-auto border border-[var(--border)] rounded-lg bg-[var(--bg2)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--bg3)] text-[var(--text)]">
            <tr>
              <th className="px-3 py-2 text-left">Rank</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Priority</th>
              <th className="px-3 py-2 text-right">Mentions</th>
              <th className="px-3 py-2 text-right">Confidence</th>
              <th className="px-3 py-2 text-right">Connections</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-left">Why Prioritized</th>
              <th className="px-3 py-2 text-left">Recommended Ask</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-4 text-[var(--text2)]">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-4 text-[var(--text2)]">No stakeholders found.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.entity_id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 text-[var(--text2)]">{row.rank}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      className="text-[var(--accent)] hover:underline"
                      onClick={() => void router.push(`/projects/${projectId}/entities/${row.entity_id}`)}
                    >
                      {row.name}
                    </button>
                    {row.degree === 0 ? (
                      <span className="px-2 py-0.5 rounded border border-[var(--border)] text-[10px] uppercase tracking-wide text-[var(--text2)] bg-[var(--bg3)]">
                        Isolated
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="px-2 py-1 rounded border border-[var(--border)] text-xs text-[var(--text2)] bg-[var(--bg3)]">
                    {row.category || row.entity_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--text2)] capitalize">{row.priority_level}</td>
                <td className="px-3 py-2 text-right text-[var(--text2)]">{row.mention_count}</td>
                <td className="px-3 py-2 text-right text-[var(--text2)]">{Math.round((row.avg_confidence || 0) * 100)}%</td>
                <td className="px-3 py-2 text-right text-[var(--text2)]">{row.degree}</td>
                <td className="px-3 py-2 text-right text-[var(--text2)]">{row.priority_score.toFixed(2)}</td>
                <td className="px-3 py-2 text-[var(--text2)]" title={row.priority_reason || row.reasoning || ''}>
                  {row.priority_reason
                    ? `${row.priority_reason.slice(0, 90)}${row.priority_reason.length > 90 ? '…' : ''}`
                    : row.reasoning
                      ? `${row.reasoning.slice(0, 90)}${row.reasoning.length > 90 ? '…' : ''}`
                      : '—'}
                </td>
                <td className="px-3 py-2 text-[var(--text2)]" title={row.recommended_ask || row.engagement_note || ''}>
                  {row.recommended_ask
                    ? `${row.recommended_ask.slice(0, 80)}${row.recommended_ask.length > 80 ? '…' : ''}`
                    : row.engagement_note
                      ? `${row.engagement_note.slice(0, 80)}${row.engagement_note.length > 80 ? '…' : ''}`
                    : generating || progress?.status === 'running'
                      ? 'Generating…'
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          className="btn-ghost"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          Previous
        </button>
        <span className="text-xs text-[var(--text2)]">Page {page} of {totalPages}</span>
        <button
          className="btn-ghost"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
