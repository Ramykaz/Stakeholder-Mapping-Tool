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
        {step.description && (
          <p className="text-sm text-[var(--muted)] mt-0.5 truncate">{step.description}</p>
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
