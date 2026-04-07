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

  const onDocumentsPage = router.asPath.includes('/documents');
  const onMapPage = router.asPath.includes('/map');

  const contextualDescription = (() => {
    if (onDocumentsPage && step.number === 3) {
      return 'Run extraction to create entities and relationships from uploaded files.';
    }
    if (onDocumentsPage && step.number === 4) {
      return 'Extraction is complete. Open the map to review and refine your graph.';
    }
    if (onMapPage && step.number === 5) {
      return 'Generate report sections from the graph insights you have reviewed.';
    }
    return step.description;
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
        <p className="font-semibold text-[var(--text)]">{step.label}</p>
        {contextualDescription && (
          <p className="text-sm text-[var(--text2)] mt-0.5 truncate">{contextualDescription}</p>
        )}
      </div>
      <button
        onClick={() => router.push(step.url)}
        className="btn-primary shrink-0 text-sm px-4 py-2"
      >
        Go to {step.label}
      </button>
    </div>
  );
}
