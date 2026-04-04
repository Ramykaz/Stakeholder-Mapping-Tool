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
  ReportStalenessResponse,
} from '@/lib/api';

export default function ProjectStakeholdersPage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';
  const [staleness, setStaleness] = useState<ReportStalenessResponse | null>(null);
  const [busy, setBusy] = useState(false);

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
            <StakeholderPriorityTable projectId={projectId} />
          </>
        )}
      </Layout>
    </>
  );
}
