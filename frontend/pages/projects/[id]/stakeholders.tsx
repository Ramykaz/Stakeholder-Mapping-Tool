import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import StakeholderPriorityTable from '@/components/StakeholderPriorityTable';

export default function ProjectStakeholdersPage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';

  return (
    <>
      <Head>
        <title>Stakeholders</title>
      </Head>
      <Layout title="Stakeholders" subtitle="Priority ranking and engagement notes">
        {!projectId ? (
          <div className="text-sm text-[var(--text3)]">Loading stakeholders…</div>
        ) : (
          <StakeholderPriorityTable projectId={projectId} />
        )}
      </Layout>
    </>
  );
}
