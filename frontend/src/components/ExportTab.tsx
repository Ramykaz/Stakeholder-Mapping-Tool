import React, { useEffect, useState } from 'react';
import {
  ReportExportStatus,
  getReportExportStatus,
  downloadReportPdf,
  downloadReportDocx,
  renderLLMErrorMessage,
} from '@/lib/api';

interface ExportTabProps {
  projectId: string;
}

function CheckIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <svg className="w-4 h-4 shrink-0" style={{ color: '#007A87' }} fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 shrink-0 text-[var(--muted)]" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function PDFIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 17h8v1.5H8V17zm0-3h8v1.5H8V14zm0-3h5v1.5H8V11z"/>
    </svg>
  );
}

function DocxIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM9 17l-2-6h1.5l1.25 3.75L11 11h1.5l-2 6H9zm5.5 0l-2-6H14l1.25 3.75L16.5 11H18l-2 6h-1.5z"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function ExportTab({ projectId }: ExportTabProps) {
  const [exportStatus, setExportStatus] = useState<ReportExportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getReportExportStatus(projectId)
      .then(setExportStatus)
      .catch((e) => setError(renderLLMErrorMessage(e, 'Export status check')))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      await downloadReportPdf(projectId);
    } catch (e: any) {
      setError(renderLLMErrorMessage(e, 'PDF export'));
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadDocx = async () => {
    setDocxBusy(true);
    try {
      await downloadReportDocx(projectId);
    } catch (e: any) {
      setError(renderLLMErrorMessage(e, 'Word export'));
    } finally {
      setDocxBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <SpinnerIcon />
        <span className="ml-2 text-sm text-[var(--muted)]">Loading export status…</span>
      </div>
    );
  }

  if (!exportStatus) {
    return (
      <div className="text-center py-8 text-sm text-[var(--muted)]">
        {error || 'Could not load export status.'}
      </div>
    );
  }

  const { can_export, complete_sections, total_sections, has_stakeholder_table, has_personas, has_workplan, section_statuses } = exportStatus;

  const summaryParts = [
    'cover page',
    'table of contents',
    `${complete_sections} of ${total_sections} analysis sections`,
    ...(has_stakeholder_table ? ['stakeholder priority table'] : []),
    ...(has_personas ? ['stakeholder personas'] : []),
    ...(has_workplan ? ['engagement workplan'] : []),
  ];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--text)] mb-1">
          {can_export ? 'Your report is ready to export' : 'Complete these steps before exporting'}
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {can_export
            ? 'Download your stakeholder analysis report in PDF or Word format.'
            : 'Complete at least one report section to enable export.'}
        </p>
      </div>

      {/* Readiness checklist */}
      <div className="card space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Readiness checklist
        </p>
        {section_statuses.map((s) => (
          <div key={s.section_number} className="flex items-center gap-2">
            <CheckIcon ok={s.status === 'done'} />
            <span className="text-sm text-[var(--text)]">
              Section {s.section_number}: {s.title}
            </span>
            {s.status === 'stale' && (
              <span className="text-xs text-amber-600 font-medium">(stale)</span>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]">
          <CheckIcon ok={has_stakeholder_table} />
          <span className="text-sm text-[var(--text)]">Stakeholder priority table</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckIcon ok={has_personas} />
          <span className="text-sm text-[var(--text)]">Stakeholder personas</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckIcon ok={has_workplan} />
          <span className="text-sm text-[var(--text)]">Stakeholder engagement workplan</span>
        </div>
      </div>

      {/* Summary line */}
      <p className="text-sm text-[var(--muted)] text-center">
        Report includes: {summaryParts.join(', ')}.
      </p>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {/* Download buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {/* PDF */}
        <button
          onClick={handleDownloadPdf}
          disabled={!can_export || pdfBusy}
          title={!can_export ? 'Complete at least one report section to export' : undefined}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#007A87', color: 'white' }}
        >
          {pdfBusy ? <SpinnerIcon /> : <PDFIcon />}
          {pdfBusy ? 'Generating…' : 'Download PDF report'}
        </button>

        {/* DOCX */}
        <button
          onClick={handleDownloadDocx}
          disabled={!can_export || docxBusy}
          title={!can_export ? 'Complete at least one report section to export' : undefined}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: '#007A87', color: '#007A87', background: 'transparent' }}
        >
          {docxBusy ? <SpinnerIcon /> : <DocxIcon />}
          {docxBusy ? 'Generating…' : 'Download Word document'}
        </button>
      </div>

      {/* Format note */}
      <p className="text-xs font-mono text-[var(--muted)] text-center leading-relaxed">
        PDF: best for sharing and printing. Includes cover page, sections, and appendices with brand colours.
        <br />
        Word: editable format. Same structure, ready for further customisation.
      </p>
    </div>
  );
}
