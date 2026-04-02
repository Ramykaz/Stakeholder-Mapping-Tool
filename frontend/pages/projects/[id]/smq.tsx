import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import SMQSection from '@/components/SMQSection';
import {
  getSMQTemplate,
  getProjectSMQ,
  getProjectDocuments,
  ProjectSMQAnswer,
  SMQTemplateSection,
} from '@/lib/api';

export default function ProjectSMQPage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';

  const [sections, setSections] = useState<SMQTemplateSection[]>([]);
  const [answers, setAnswers] = useState<Record<string, ProjectSMQAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    setError('');

    Promise.all([
      getSMQTemplate(),
      getProjectSMQ(projectId),
      getProjectDocuments(projectId),
    ])
      .then(([template, response, docs]) => {
        setSections((template.sections || []).slice().sort((a, b) => a.order - b.order || a.section_number - b.section_number));
        const bySection: Record<string, ProjectSMQAnswer> = {};
        (response.answers || []).forEach((answer) => {
          bySection[answer.section_id] = answer;
        });
        setAnswers(bySection);
        setHasDocuments((docs || []).length > 0);
      })
      .catch(() => setError('Failed to load SMQ.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const orderedSections = useMemo(
    () => sections.slice().sort((a, b) => a.order - b.order || a.section_number - b.section_number),
    [sections]
  );

  const onUpdated = (sectionId: string, answer: ProjectSMQAnswer) => {
    setAnswers((prev) => ({ ...prev, [sectionId]: answer }));
  };

  return (
    <>
      <Head>
        <title>SMQ</title>
      </Head>
      <Layout title="SMQ" subtitle="Stakeholder Mapping Questionnaire">
        {loading && <div className="text-sm text-[var(--text3)]">Loading SMQ…</div>}
        {!loading && error && <div className="text-sm text-[var(--coral,#f0614a)]">{error}</div>}
        {!loading && !error && !hasDocuments && (
          <div className="card text-sm text-[var(--text3)] mb-3">No documents extracted yet. You can still fill sections manually.</div>
        )}

        <div className="space-y-3">
          {orderedSections.map((section) => (
            <SMQSection
              key={section.id}
              projectId={projectId}
              section={section}
              existingAnswer={answers[section.id]}
              aiEnabled={hasDocuments}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      </Layout>
    </>
  );
}
