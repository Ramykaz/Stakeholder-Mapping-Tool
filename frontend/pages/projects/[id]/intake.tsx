import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import IntakeForm from '@/components/IntakeForm';

export default function ProjectIntakePage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';

  return (
    <>
      <Head>
        <title>Initiative Profile</title>
      </Head>
      <Layout title="Initiative Profile" subtitle="Structured context used across extraction and reports">
        {projectId ? <IntakeForm projectId={projectId} /> : null}
      </Layout>
    </>
  );
}
