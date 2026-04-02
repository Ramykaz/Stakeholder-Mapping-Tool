import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ReportSectionCard from '@/components/ReportSectionCard';
import {
  exportProjectReportPdf,
  generateProjectReport,
  getProjectReport,
  saveProjectReportSection,
  regenerateProjectReportSection,
  ReportSectionResponse,
} from '@/lib/api';

export default function ProjectReportPage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';

  const [sections, setSections] = useState<ReportSectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadReport = useCallback(async () => {
    if (!projectId) return;
    const data = await getProjectReport(projectId);
    const sorted = (data.sections || []).slice().sort((a, b) => a.section_number - b.section_number);
    setSections(sorted);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    loadReport()
      .catch(() => setMessage('Failed to load report sections.'))
      .finally(() => setLoading(false));
  }, [projectId, loadReport]);

  const shouldPoll = useMemo(
    () => sections.some((section) => section.status === 'pending' || section.status === 'generating'),
    [sections]
  );

  useEffect(() => {
    if (!projectId || !shouldPoll) return;
    const timer = setInterval(() => {
      loadReport().catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [projectId, shouldPoll, loadReport]);

  const allDone = sections.length > 0 && sections.every((section) => section.status === 'done');

  const onGenerateAll = async () => {
    if (!projectId) return;
    setBusy(true);
    setMessage('');
    try {
      await generateProjectReport(projectId, 'all');
      setMessage('Generation started.');
      await loadReport();
    } catch {
      setMessage('Failed to start generation.');
    } finally {
      setBusy(false);
    }
  };

  const onRegenerate = async (sectionId: string, customInstruction?: string) => {
    if (!projectId) return;
    setBusy(true);
    setMessage('');
    try {
      await regenerateProjectReportSection(projectId, sectionId, customInstruction);
      setMessage('Regeneration started.');
      await loadReport();
    } catch {
      setMessage('Failed to start regeneration.');
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdit = async (sectionId: string, generatedText: string) => {
    if (!projectId) return;
    setBusy(true);
    setMessage('');
    try {
      await saveProjectReportSection(projectId, sectionId, generatedText);
      setMessage('Section updated.');
      await loadReport();
    } catch {
      setMessage('Failed to save section edits.');
    } finally {
      setBusy(false);
    }
  };

  const onExportPdf = async () => {
    if (!projectId || !allDone) return;
    setBusy(true);
    setMessage('');
    try {
      const blob = await exportProjectReportPdf(projectId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `stakeholder-report-${projectId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setMessage('PDF export started.');
    } catch {
      setMessage('Failed to export PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>Report</title>
      </Head>
      <Layout title="Report" subtitle="Per-section stakeholder report generation">
        {loading ? <div className="text-sm text-[var(--text3)]">Loading report…</div> : null}

        <div className="flex items-center gap-2 mb-3">
          <button className="btn-primary" disabled={busy} onClick={() => void onGenerateAll()}>
            {busy ? 'Working…' : 'Generate All Sections'}
          </button>
          <button className="btn-ghost" disabled={busy || !allDone} onClick={() => void onExportPdf()}>
            Export PDF
          </button>
        </div>

        {message ? (
          <p className={`text-xs mb-3 ${message.includes('Failed') ? 'text-[var(--coral,#f0614a)]' : 'text-[var(--teal)]'}`}>
            {message}
          </p>
        ) : null}

        <div className="space-y-3">
          {sections.map((section) => (
            <ReportSectionCard key={section.section_id} section={section} busy={busy} onRegenerate={onRegenerate} onSaveEdit={onSaveEdit} />
          ))}
        </div>
      </Layout>
    </>
  );
}
