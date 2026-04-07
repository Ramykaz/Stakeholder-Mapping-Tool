import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import StakeholderPriorityTable from '@/components/StakeholderPriorityTable';
import StalenessNotice from '@/components/StalenessNotice';
import {
  generateProjectStakeholderNotes,
  getReportStaleness,
  keepStakeholderTableCurrent,
  renderLLMErrorMessage,
  ReportStalenessResponse,
  StakeholderNotesGenerationResponse,
} from '@/lib/api';

export default function ProjectStakeholdersPage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';
  const [staleness, setStaleness] = useState<ReportStalenessResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [generationState, setGenerationState] = useState<StakeholderNotesGenerationResponse | null>(null);

  const loadStaleness = useCallback(async () => {
    if (!projectId) return;
    const data = await getReportStaleness(projectId);
    setStaleness(data);
  }, [projectId]);

  useEffect(() => {
    loadStaleness().catch(() => {});
  }, [loadStaleness]);

  const onRegenerate = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      await generateProjectStakeholderNotes(projectId);
      await loadStaleness();
    } finally {
      setBusy(false);
    }
  };

  const onKeepCurrent = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      await keepStakeholderTableCurrent(projectId);
      await loadStaleness();
    } finally {
      setBusy(false);
    }
  };

  const onResumeGeneration = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      const result = await generateProjectStakeholderNotes(projectId, { action: 'resume', max_items: 20 });
      setGenerationState(result);
    } catch (error) {
      setGenerationState({
        status: 'error',
        total_target: generationState?.total_target || 0,
        completed_count: generationState?.completed_count || 0,
        current_index: generationState?.current_index || 0,
        message: renderLLMErrorMessage(error, 'Stakeholder note generation'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>Stakeholders</title>
      </Head>
      <Layout title="Stakeholders" subtitle="Priority ranking and engagement notes">
        {!projectId ? (
          <div className="text-sm text-[var(--text3)]">Loading stakeholders…</div>
        ) : (
          <>
            {staleness?.stakeholder_table_stale && (
              <div className="mb-3">
                <StalenessNotice
                  title="Stakeholder table was generated before new documents were added."
                  onRegenerate={() => void onRegenerate()}
                  onKeepCurrent={() => void onKeepCurrent()}
                  isRegenerating={busy}
                />
              </div>
            )}
            {generationState?.status === 'paused_rate_limited' && (
              <div className="mb-3">
                <StalenessNotice
                  variant="rate_limit"
                  title={generationState.message || 'Provider rate limit reached. Retry now or adjust provider settings.'}
                  primaryLabel="Resume generation"
                  secondaryLabel="Open settings"
                  onRegenerate={() => void onResumeGeneration()}
                  onKeepCurrent={() => void router.push(`/projects/${projectId}/settings`)}
                  isRegenerating={busy}
                />
              </div>
            )}
            <StakeholderPriorityTable
              projectId={projectId}
              generationState={generationState}
              onGenerationStateChange={setGenerationState}
            />
          </>
        )}
      </Layout>
    </>
  );
}
