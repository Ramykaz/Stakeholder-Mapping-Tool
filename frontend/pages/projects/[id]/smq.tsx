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
  const [activeIndex, setActiveIndex] = useState(0);

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

  const clampedIndex = Math.min(Math.max(activeIndex, 0), Math.max(orderedSections.length - 1, 0));
  const activeSection = orderedSections[clampedIndex];

  return (
    <>
      <Head>
        <title>SMQ</title>
      </Head>
      <Layout title="SMQ" subtitle="Stakeholder Mapping Questionnaire">
        {loading && <div className="text-sm text-[var(--text2)]">Loading SMQ…</div>}
        {!loading && error && <div className="text-sm text-[var(--coral,#f0614a)]">{error}</div>}
        {!loading && !error && !hasDocuments && (
          <div className="card text-sm text-[var(--text2)] mb-3">No documents extracted yet. You can still fill sections manually.</div>
        )}

        {!loading && !error && orderedSections.length > 0 && activeSection && (
          <div className="space-y-3">
            <div className="card flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text2)]">
                  Section {clampedIndex + 1} of {orderedSections.length}
                </p>
                <p className="text-xs text-[var(--text3)] mt-1">
                  Focus on one section at a time. Use notes to guide AI generation context.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-ghost"
                  disabled={clampedIndex <= 0}
                  onClick={() => setActiveIndex((prev) => Math.max(prev - 1, 0))}
                >
                  Previous
                </button>
                <button
                  className="btn-ghost"
                  disabled={clampedIndex >= orderedSections.length - 1}
                  onClick={() => setActiveIndex((prev) => Math.min(prev + 1, orderedSections.length - 1))}
                >
                  Next
                </button>
              </div>
            </div>

            <SMQSection
              key={activeSection.id}
              projectId={projectId}
              section={activeSection}
              existingAnswer={answers[activeSection.id]}
              aiEnabled={hasDocuments}
              onUpdated={onUpdated}
            />
          </div>
        )}
      </Layout>
    </>
  );
}
