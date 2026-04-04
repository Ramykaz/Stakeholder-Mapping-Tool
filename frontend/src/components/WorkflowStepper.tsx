import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { WorkflowStatus } from '@/lib/api';

interface WorkflowStepperProps {
  workflow: WorkflowStatus;
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function WorkflowStepper({ workflow }: WorkflowStepperProps) {
  const router = useRouter();
  const { current_step, steps } = workflow;
  const [mobileStep, setMobileStep] = useState(current_step - 1); // 0-indexed

  const currentStepData = steps[mobileStep] || steps[current_step - 1];

  return (
    <div
      className="w-full px-4 py-3"
      style={{ background: 'var(--surface-alt, rgba(0,122,135,0.04))' }}
    >
      {/* Desktop stepper */}
      <nav className="hidden md:flex items-center justify-between gap-0">
        {steps.map((step, idx) => {
          const isComplete = step.complete;
          const isActive = step.number === current_step;
          const prevComplete = idx > 0 && steps[idx - 1].complete;

          return (
            <React.Fragment key={step.number}>
              {/* Connecting line before step */}
              {idx > 0 && (
                <div
                  className="flex-1 h-px"
                  style={{
                    background: prevComplete ? '#007A87' : '#D1D5DB',
                    borderStyle: prevComplete ? 'solid' : 'dashed',
                  }}
                />
              )}

              {/* Step circle + label */}
              <button
                onClick={() => router.push(step.url)}
                className="flex flex-col items-center gap-1 group shrink-0"
                title={step.label}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isActive && !isComplete ? 'animate-pulse' : ''
                  }`}
                  style={
                    isComplete
                      ? { background: '#007A87', color: 'white' }
                      : isActive
                      ? {
                          background: '#007A87',
                          color: 'white',
                          boxShadow: '0 0 0 3px rgba(0,122,135,0.25)',
                        }
                      : {
                          background: 'transparent',
                          color: '#9CA3AF',
                          border: '2px solid #E5E7EB',
                        }
                  }
                >
                  {isComplete ? <CheckIcon /> : step.number}
                </div>
                <span
                  className="text-[10px] leading-tight text-center max-w-[60px]"
                  style={{ color: isActive || isComplete ? '#007A87' : '#9CA3AF' }}
                >
                  {step.label}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Mobile collapsed stepper */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={() => setMobileStep((s) => Math.max(0, s - 1))}
          disabled={mobileStep === 0}
          className="p-1 rounded disabled:opacity-30"
          aria-label="Previous step"
        >
          <svg className="w-5 h-5 text-[var(--text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => router.push(currentStepData.url)}
          className="flex-1 text-center text-sm font-medium text-[var(--text)]"
        >
          Step {currentStepData.number} of {steps.length} —{' '}
          <span style={{ color: '#007A87' }}>{currentStepData.label}</span>
        </button>

        <button
          onClick={() => setMobileStep((s) => Math.min(steps.length - 1, s + 1))}
          disabled={mobileStep === steps.length - 1}
          className="p-1 rounded disabled:opacity-30"
          aria-label="Next step"
        >
          <svg className="w-5 h-5 text-[var(--text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

    </div>
  );
}
