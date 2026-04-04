import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ReportSectionCard from '@/components/ReportSectionCard';
import PersonaCard, { PersonaCardSkeleton } from '@/components/PersonaCard';
import WorkplanAccordion, { WorkplanAccordionSkeleton } from '@/components/WorkplanAccordion';
import StalenessNotice from '@/components/StalenessNotice';
import ExportTab from '@/components/ExportTab';
import { getEntityColor } from '@/lib/entityTypes';
import {
  generateProjectReport,
  generateProjectPersonas,
  generateProjectWorkplan,
  getProjectPersonas,
  getProjectReport,
  getReportStaleness,
  getProjectWorkplan,
  getProjectWorkplanStatus,
  keepReportSectionCurrent,
  ReportStalenessResponse,
  saveProjectReportSection,
  regenerateProjectReportSection,
  ReportSectionResponse,
  WorkplanResponse,
} from '@/lib/api';

type ReportTab = 'report' | 'workplan' | 'export';

function parseTab(tab: string | string[] | undefined): ReportTab {
  const value = Array.isArray(tab) ? tab[0] : tab;
  if (value === 'workplan' || value === 'export') return value;
  return 'report';
}

export default function ProjectReportPage() {
  const router = useRouter();
  const { id, tab } = router.query;
  const projectId = typeof id === 'string' ? id : '';
  const activeTab = parseTab(tab);

  const [sections, setSections] = useState<ReportSectionResponse[]>([]);
  const [staleness, setStaleness] = useState<ReportStalenessResponse>({
    stale_sections: [],
    stakeholder_table_stale: false,
    new_entity_count: 0,
  });
  const [personas, setPersonas] = useState<Awaited<ReturnType<typeof getProjectPersonas>>['results']>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [generatingPersonas, setGeneratingPersonas] = useState(false);
  const [workplan, setWorkplan] = useState<WorkplanResponse | null>(null);
  const [workplanLoading, setWorkplanLoading] = useState(false);
  const [workplanGenerating, setWorkplanGenerating] = useState(false);
  const [section6Complete, setSection6Complete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadReport = useCallback(async () => {
    if (!projectId) return;
    const data = await getProjectReport(projectId);
    const sorted = (data.sections || []).slice().sort((a, b) => a.section_number - b.section_number);
    setSections(sorted);
  }, [projectId]);

  const loadStaleness = useCallback(async () => {
    if (!projectId) return;
    const stale = await getReportStaleness(projectId);
    setStaleness(stale);
  }, [projectId]);

  const loadPersonas = useCallback(async () => {
    if (!projectId) return;
    const data = await getProjectPersonas(projectId);
    setPersonas(data.results || []);
  }, [projectId]);

  const loadWorkplan = useCallback(async () => {
    if (!projectId) return;
    setWorkplanLoading(true);
    try {
      const [statusData, planData] = await Promise.all([
        getProjectWorkplanStatus(projectId),
        getProjectWorkplan(projectId),
      ]);
      setSection6Complete(statusData.section_6_complete);
      setWorkplan(planData);
    } finally {
      setWorkplanLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([loadReport(), loadStaleness()])
      .catch(() => setMessage('Failed to load report sections.'))
      .finally(() => setLoading(false));
  }, [projectId, loadReport, loadStaleness]);

  useEffect(() => {
    if (!projectId) return;
    setPersonasLoading(true);
    loadPersonas()
      .catch(() => {})
      .finally(() => setPersonasLoading(false));
    loadWorkplan().catch(() => {});
  }, [projectId, loadPersonas, loadWorkplan]);

  const shouldPoll = useMemo(
    () =>
      sections.some((section) => section.status === 'pending' || section.status === 'generating') ||
      generatingPersonas ||
      workplanGenerating,
    [sections, generatingPersonas, workplanGenerating]
  );

  useEffect(() => {
    if (!projectId || !shouldPoll) return;
    const timer = setInterval(() => {
      Promise.all([
        loadReport(),
        loadStaleness(),
        generatingPersonas ? loadPersonas() : Promise.resolve(),
        workplanGenerating ? loadWorkplan() : Promise.resolve(),
      ])
        .then(() => {
          if (generatingPersonas && personas.length > 0) setGeneratingPersonas(false);
          if (workplanGenerating && workplan?.generated) setWorkplanGenerating(false);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [
    projectId,
    shouldPoll,
    loadReport,
    loadStaleness,
    loadPersonas,
    loadWorkplan,
    generatingPersonas,
    workplanGenerating,
    personas.length,
    workplan?.generated,
  ]);

  const setTab = (nextTab: ReportTab) => {
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, tab: nextTab } },
      undefined,
      { shallow: true }
    );
  };

  const onGenerateAll = async () => {
    if (!projectId) return;
    setBusy(true);
    setMessage('');
    try {
      await generateProjectReport(projectId, 'all');
      setMessage('Generation started.');
      await Promise.all([loadReport(), loadStaleness()]);
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
      await Promise.all([loadReport(), loadStaleness()]);
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
      await Promise.all([loadReport(), loadStaleness()]);
    } catch {
      setMessage('Failed to save section edits.');
    } finally {
      setBusy(false);
    }
  };

  const onGeneratePersonas = async () => {
    if (!projectId) return;
    setGeneratingPersonas(true);
    setMessage('');
    try {
      await generateProjectPersonas(projectId);
      setMessage('Persona generation started.');
      await loadPersonas();
    } catch {
      setMessage('Failed to start persona generation.');
      setGeneratingPersonas(false);
    }
  };

  const onGenerateWorkplan = async () => {
    if (!projectId || !section6Complete) return;
    setWorkplanGenerating(true);
    setMessage('');
    try {
      await generateProjectWorkplan(projectId);
      setMessage('Workplan generation started.');
      await loadWorkplan();
    } catch {
      setMessage('Failed to start workplan generation.');
      setWorkplanGenerating(false);
    }
  };

  const onRegenerateAllStale = async () => {
    if (!projectId || staleness.stale_sections.length === 0) return;
    setBusy(true);
    setMessage('');
    try {
      const staleSections = sections
        .filter((section) => staleness.stale_sections.includes(section.section_number))
        .sort((a, b) => a.section_number - b.section_number);
      for (const section of staleSections) {
        await regenerateProjectReportSection(projectId, section.section_id);
      }
      setMessage('Regeneration started for stale sections.');
      await Promise.all([loadReport(), loadStaleness()]);
    } catch {
      setMessage('Failed to regenerate stale sections.');
    } finally {
      setBusy(false);
    }
  };

  const onKeepAllStaleCurrent = async () => {
    if (!projectId || staleness.stale_sections.length === 0) return;
    try {
      const staleSections = sections.filter((section) => staleness.stale_sections.includes(section.section_number));
      for (const section of staleSections) {
        await keepReportSectionCurrent(projectId, section.section_id);
      }
      await Promise.all([loadReport(), loadStaleness()]);
    } catch {
      setMessage('Failed to keep current versions for stale sections.');
    }
  };

  const onKeepSectionCurrent = async (sectionId: string) => {
    if (!projectId) return;
    try {
      await keepReportSectionCurrent(projectId, sectionId);
      await Promise.all([loadReport(), loadStaleness()]);
    } catch {
      setMessage('Failed to keep current section version.');
    }
  };

  const section6Stale = sections.some((section) => section.section_number === 6 && section.status === 'stale');

  return (
    <>
      <Head>
        <title>Report</title>
      </Head>
      <Layout
        title="Report"
        subtitle="Per-section stakeholder report generation"
        hideNextStep={activeTab === 'export'}
      >
        <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)]">
          <button
            className={`px-3 py-2 text-sm border-b-2 ${activeTab === 'report' ? 'border-[var(--teal)] text-[var(--text)]' : 'border-transparent text-[var(--text3)]'}`}
            onClick={() => setTab('report')}
          >
            Report
          </button>
          <button
            className={`px-3 py-2 text-sm border-b-2 ${activeTab === 'workplan' ? 'border-[var(--teal)] text-[var(--text)]' : 'border-transparent text-[var(--text3)]'}`}
            onClick={() => setTab('workplan')}
          >
            Workplan
          </button>
          <button
            className={`px-3 py-2 text-sm border-b-2 ${activeTab === 'export' ? 'border-[var(--teal)] text-[var(--text)]' : 'border-transparent text-[var(--text3)]'}`}
            onClick={() => setTab('export')}
          >
            Export
          </button>
        </div>

        {loading ? <div className="text-sm text-[var(--text3)]">Loading report…</div> : null}

        {message ? (
          <p className={`text-xs mb-3 ${message.includes('Failed') ? 'text-[var(--coral,#f0614a)]' : 'text-[var(--teal)]'}`}>
            {message}
          </p>
        ) : null}

        {activeTab === 'report' && (
          <>
            {staleness.stale_sections.length > 0 && (
              <div className="mb-3">
                <StalenessNotice
                  title="Some sections were generated before new documents were added."
                  onRegenerate={() => void onRegenerateAllStale()}
                  onKeepCurrent={() => void onKeepAllStaleCurrent()}
                  isRegenerating={busy}
                />
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <button className="btn-primary" disabled={busy} onClick={() => void onGenerateAll()}>
                {busy ? 'Working…' : 'Generate All Sections'}
              </button>
            </div>

            <div className="space-y-3">
              {sections.map((section) => (
                <div key={section.section_id} id={`section-${section.section_number}`}>
                  {section.status === 'stale' && (
                    <div className="mb-2">
                      <StalenessNotice
                        title={`Section ${section.section_number} is stale due to newer extracted documents.`}
                        onRegenerate={() => void onRegenerate(section.section_id)}
                        onKeepCurrent={() => void onKeepSectionCurrent(section.section_id)}
                        isRegenerating={busy}
                      />
                    </div>
                  )}
                  <ReportSectionCard
                    section={section}
                    busy={busy}
                    onRegenerate={onRegenerate}
                    onSaveEdit={onSaveEdit}
                  />
                </div>
              ))}
            </div>

            <hr className="my-6 border-[var(--border)]" />
            <div id="personas" className="mb-3">
              <h2 className="font-[var(--serif)] text-xl text-[var(--text)] mb-2">Stakeholder Personas</h2>
              <button className="btn-primary" disabled={generatingPersonas} onClick={() => void onGeneratePersonas()}>
                {generatingPersonas ? 'Generating…' : 'Generate personas'}
              </button>
            </div>

            {personasLoading || generatingPersonas ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => <PersonaCardSkeleton key={i} />)}
              </div>
            ) : personas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {personas.map((persona) => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    entityTypeColor={getEntityColor(persona.entity_type_label || '')}
                    onEntityClick={(entityId) => void router.push(`/projects/${projectId}/entities/${entityId}`)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text3)]">
                Not enough data to generate a persona for this stakeholder type.
              </p>
            )}
          </>
        )}

        {activeTab === 'workplan' && (
          <div className="space-y-3">
            <div>
              <h2 className="font-[var(--serif)] text-xl text-[var(--text)]">Stakeholder Engagement Workplan</h2>
              <p className="text-sm text-[var(--text2)] mt-1">Generated from Section 6 (Stakeholder Engagement Strategies).</p>
            </div>

            {!section6Complete ? (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Complete Section 6 (Stakeholder Engagement Strategies) first.
              </div>
            ) : null}

            {section6Stale ? (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Section 6 is marked stale. Regenerate it to refresh workplan quality.
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                className="btn-primary"
                disabled={workplanGenerating || !section6Complete}
                title={!section6Complete ? 'Complete Section 6 (Stakeholder Engagement Strategies) first.' : undefined}
                onClick={() => void onGenerateWorkplan()}
              >
                {workplanGenerating ? 'Generating…' : 'Generate workplan'}
              </button>
            </div>

            {section6Complete && workplan && !workplan.generated && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Section 6 is complete but no workplan has been generated yet.
              </div>
            )}

            {workplanLoading || workplanGenerating ? (
              <WorkplanAccordionSkeleton />
            ) : (
              <WorkplanAccordion
                components={workplan?.components || []}
                onEntityClick={(entityId) => void router.push(`/projects/${projectId}/entities/${entityId}`)}
              />
            )}
          </div>
        )}

        {activeTab === 'export' && projectId && (
          <ExportTab projectId={projectId} />
        )}
      </Layout>
    </>
  );
}
