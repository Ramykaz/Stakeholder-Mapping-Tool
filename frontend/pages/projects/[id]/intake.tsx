import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import IntakeForm from '@/components/IntakeForm';

export default function ProjectIntakePage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const onRouteChangeStart = (url: string) => {
      if (!hasUnsavedChanges) return;
      if (url === router.asPath) return;
      const confirmed = window.confirm('You have unsaved initiative profile changes. Leave this page anyway?');
      if (!confirmed) {
        router.events.emit('routeChangeError');
        throw new Error('Route change aborted due to unsaved changes.');
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    router.events.on('routeChangeStart', onRouteChangeStart);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      router.events.off('routeChangeStart', onRouteChangeStart);
    };
  }, [hasUnsavedChanges, router]);

  return (
    <>
      <Head>
        <title>Initiative Profile</title>
      </Head>
      <Layout title="Initiative Profile" subtitle="Structured context used across extraction and reports">
        {hasUnsavedChanges && (
          <div className="card mb-3 border-[var(--amber,#f59e0b)] bg-[color-mix(in_srgb,var(--amber,#f59e0b)_12%,var(--bg2))] text-sm text-[var(--text)]">
            You have unsaved profile changes.
          </div>
        )}
        {projectId ? <IntakeForm projectId={projectId} onDirtyChange={setHasUnsavedChanges} /> : null}
      </Layout>
    </>
  );
}
