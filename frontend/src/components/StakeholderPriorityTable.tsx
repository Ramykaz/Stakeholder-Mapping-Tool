import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  exportProjectStakeholderPriorityCsv,
  generateProjectStakeholderNotes,
  getProjectStakeholderPriority,
  StakeholderPriorityRow,
} from '@/lib/api';

interface Props {
  projectId: string;
}

const ENTITY_TYPES = ['PERSON', 'ORGANIZATION', 'GOVERNMENT', 'LOCATION', 'ROLE', 'EVENT', 'PROJECT', 'POLICY', 'CONCEPT', 'THEME'];

export default function StakeholderPriorityTable({ projectId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<StakeholderPriorityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState('');

  const loadRows = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await getProjectStakeholderPriority(projectId, {
        entity_type: entityType || undefined,
        page,
      });
      setRows(data.results || []);
      setTotalPages(data.total_pages || 1);
    } catch {
      setMessage('Failed to load stakeholder priority table.');
    } finally {
      setLoading(false);
    }
  }, [projectId, entityType, page]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const typeOptions = useMemo(() => ENTITY_TYPES, []);

  const onGenerateNotes = async () => {
    if (!projectId) return;
    setGenerating(true);
    setMessage('');
    try {
      await generateProjectStakeholderNotes(projectId);
      setMessage('Engagement note generation started.');
      setTimeout(() => {
        void loadRows();
      }, 2500);
    } catch {
      setMessage('Failed to generate engagement notes.');
    } finally {
      setGenerating(false);
    }
  };

  const onExportCsv = async () => {
    if (!projectId) return;
    try {
      const blob = await exportProjectStakeholderPriorityCsv(projectId, entityType || undefined);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `stakeholder-priority-${projectId}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage('Failed to export CSV.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
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
        <button className="btn-ghost" disabled={loading} onClick={() => void onExportCsv()}>
          Export CSV
        </button>
      </div>

      {message ? (
        <p className={`text-xs ${message.includes('Failed') ? 'text-[var(--coral,#f0614a)]' : 'text-[var(--teal)]'}`}>
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto border border-[var(--border)] rounded-lg bg-[var(--bg2)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--bg3)] text-[var(--text2)]">
            <tr>
              <th className="px-3 py-2 text-left">Rank</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Priority</th>
              <th className="px-3 py-2 text-right">Mentions</th>
              <th className="px-3 py-2 text-right">Confidence</th>
              <th className="px-3 py-2 text-right">Connections</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-left">Reasoning</th>
              <th className="px-3 py-2 text-left">Recommended Ask</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-4 text-[var(--text3)]">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-4 text-[var(--text3)]">No stakeholders found.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.entity_id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 text-[var(--text2)]">{row.rank}</td>
                <td className="px-3 py-2">
                  <button
                    className="text-[var(--accent)] hover:underline"
                    onClick={() => void router.push(`/projects/${projectId}/entities/${row.entity_id}`)}
                  >
                    {row.name}
                  </button>
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
                <td className="px-3 py-2 text-[var(--text2)]" title={row.reasoning || ''}>
                  {row.reasoning
                    ? `${row.reasoning.slice(0, 80)}${row.reasoning.length > 80 ? '…' : ''}`
                    : '—'}
                </td>
                <td className="px-3 py-2 text-[var(--text2)]" title={row.recommended_ask || row.engagement_note || ''}>
                  {row.recommended_ask
                    ? `${row.recommended_ask.slice(0, 80)}${row.recommended_ask.length > 80 ? '…' : ''}`
                    : row.engagement_note
                      ? `${row.engagement_note.slice(0, 80)}${row.engagement_note.length > 80 ? '…' : ''}`
                    : generating
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
        <span className="text-xs text-[var(--text3)]">Page {page} of {totalPages}</span>
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
