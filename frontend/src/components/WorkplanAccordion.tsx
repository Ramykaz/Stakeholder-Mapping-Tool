import React, { useState } from 'react';
import { WorkplanComponentResponse, WorkplanTaskResponse } from '@/lib/api';

interface WorkplanAccordionProps {
  components: WorkplanComponentResponse[];
  onEntityClick?: (entityId: string) => void;
}

interface TaskRowProps {
  task: WorkplanTaskResponse;
  onEntityClick?: (entityId: string) => void;
}

function TaskRow({ task, onEntityClick }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-[var(--border)] cursor-pointer hover:bg-[var(--surface-alt)] transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-2.5 px-3 text-sm text-[var(--text)] w-[40%]">
          <span className="line-clamp-2">{task.task_description}</span>
        </td>
        <td className="py-2.5 px-3 text-sm text-[var(--muted)] w-[20%]">
          {task.suggested_owner || '—'}
        </td>
        <td className="py-2.5 px-3 text-sm text-[var(--muted)] w-[20%]">
          {task.timeline || '—'}
        </td>
        <td className="py-2.5 px-3 text-sm text-[var(--muted)] w-[20%]">
          <span className="line-clamp-2">{task.kpis || '—'}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[var(--border)]">
          <td colSpan={4} className="px-4 py-3 bg-[var(--surface-alt)]">
            <div className="space-y-2">
              <p className="text-sm text-[var(--text)] leading-relaxed">
                {task.task_description}
              </p>
              {task.dependencies && (
                <p className="text-xs text-[var(--muted)]">
                  <span className="font-semibold">Dependencies:</span> {task.dependencies}
                </p>
              )}
              {task.related_entity && onEntityClick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEntityClick(task.related_entity!.id);
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: '#007A8722', color: '#007A87' }}
                >
                  {task.related_entity.name}
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ComponentPanel({ component, onEntityClick }: {
  component: WorkplanComponentResponse;
  onEntityClick?: (entityId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface)] hover:bg-[var(--surface-alt)] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold text-[var(--text)] text-left">{component.title}</span>
        <svg
          className={`w-4 h-4 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--accent-subtle,#EBF4F5)] text-[var(--text)]">
                <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide w-[40%]">Task</th>
                <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide w-[20%]">Owner</th>
                <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide w-[20%]">Timeline</th>
                <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide w-[20%]">KPIs</th>
              </tr>
            </thead>
            <tbody>
              {component.tasks.map((task) => (
                <TaskRow key={task.id} task={task} onEntityClick={onEntityClick} />
              ))}
              {component.tasks.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-sm text-[var(--muted)]">
                    No tasks in this component.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function WorkplanAccordion({ components, onEntityClick }: WorkplanAccordionProps) {
  if (components.length === 0) {
    return (
      <p className="text-[var(--muted)] text-sm text-center py-8">
        No workplan components found.
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {components.map((component) => (
        <ComponentPanel key={component.id} component={component} onEntityClick={onEntityClick} />
      ))}
    </div>
  );
}

export function WorkplanAccordionSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-[var(--surface)] flex items-center justify-between">
            <div className="h-4 w-48 rounded bg-[var(--border)]" />
            <div className="h-4 w-4 rounded bg-[var(--border)]" />
          </div>
          <div className="p-3 space-y-2">
            {[1, 2].map((j) => (
              <div key={j} className="h-8 w-full rounded bg-[var(--border)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
