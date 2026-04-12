import React from 'react';
import { useRouter } from 'next/router';
import { WorkflowStep } from '@/lib/api';

interface NextStepCardProps {
  step: WorkflowStep;
  show?: boolean;
}

export default function NextStepCard({ step, show = true }: NextStepCardProps) {
  const router = useRouter();

  if (!show) return null;

  const projectId = (router.query.id as string | undefined) || '';
  const currentPath = ((router.asPath || '').split('?')[0] || '').replace(/\/$/, '');
  const fullPath = router.asPath || '';

  const orderedFlow: WorkflowStep[] = projectId
    ? [
        {
          number: 1,
          label: 'Define initiative',
          complete: false,
          url: `/projects/${projectId}/intake`,
          description: 'Fill in the initiative profile and objectives',
        },
        {
          number: 2,
          label: 'Upload documents',
          complete: false,
          url: `/projects/${projectId}/documents`,
          description: 'Upload and process source documents for analysis',
        },
        {
          number: 3,
          label: 'Run extraction',
          complete: false,
          url: `/projects/${projectId}/analyze`,
          description: 'Extract entities and relationships from documents',
        },
        {
          number: 4,
          label: 'Review graph',
          complete: false,
          url: `/projects/${projectId}/map`,
          description: 'Review and refine the extracted knowledge graph',
        },
        {
          number: 5,
          label: 'Generate report',
          complete: false,
          url: `/projects/${projectId}/report`,
          description: 'Generate stakeholder report sections',
        },
        {
          number: 6,
          label: 'Stakeholder table',
          complete: false,
          url: `/projects/${projectId}/stakeholders`,
          description: 'Generate and review the stakeholder priority table',
        },
        {
          number: 7,
          label: 'Export',
          complete: false,
          url: `/projects/${projectId}/report?tab=export`,
          description: 'Export final outputs as PDF or DOCX',
        },
      ]
    : [];

  const pageStepNumber = (() => {
    if (!projectId) return null;
    if (fullPath.includes('/report?tab=export')) return 7;
    if (currentPath.includes(`/projects/${projectId}/stakeholders`)) return 6;
    if (currentPath.includes(`/projects/${projectId}/report`)) return 5;
    if (currentPath.includes(`/projects/${projectId}/smq`)) return 5;
    if (currentPath.includes(`/projects/${projectId}/map`)) return 4;
    if (currentPath.includes(`/projects/${projectId}/analyze`)) return 3;
    if (currentPath.includes(`/projects/${projectId}/documents`)) return 2;
    if (currentPath.includes(`/projects/${projectId}/intake`) || currentPath.includes(`/projects/${projectId}/setup`)) return 1;
    return null;
  })();

  const currentIndex = pageStepNumber
    ? orderedFlow.findIndex((item) => item.number === pageStepNumber)
    : orderedFlow.findIndex((item) => currentPath === item.url.split('?')[0].replace(/\/$/, ''));
  const routeBasedStep = currentIndex >= 0 ? orderedFlow[currentIndex + 1] : null;
  const effectiveStep = routeBasedStep || step;

  const onDocumentsPage = router.asPath.includes('/documents');
  const onMapPage = router.asPath.includes('/map');

  const contextualDescription = (() => {
    if (onDocumentsPage && effectiveStep.number === 3) {
      return 'Run extraction to create entities and relationships from uploaded files.';
    }
    if (onDocumentsPage && effectiveStep.number === 4) {
      return 'Extraction is complete. Open the map to review and refine your graph.';
    }
    if (onMapPage && effectiveStep.number === 5) {
      return 'Generate report sections from the graph insights you have reviewed.';
    }
    return effectiveStep.description;
  })();

  return (
    <div
      className="w-full flex items-center justify-between gap-4 p-4 rounded-lg border-l-4 bg-[var(--surface)]"
      style={{ borderLeftColor: '#007A87', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-0.5">
          Next step
        </p>
        <p className="font-semibold text-[var(--text)]">{effectiveStep.label}</p>
        {contextualDescription && (
          <p className="text-sm text-[var(--text2)] mt-0.5 truncate">{contextualDescription}</p>
        )}
      </div>
      <button
        onClick={() => router.push(effectiveStep.url)}
        className="btn-primary shrink-0 text-sm px-4 py-2"
      >
        Go to {effectiveStep.label}
      </button>
    </div>
  );
}
