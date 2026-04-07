import React from 'react';
import { StakeholderPersonaResponse } from '@/lib/api';

interface PersonaCardProps {
  persona: StakeholderPersonaResponse;
  onEntityClick: (entityId: string) => void;
  entityTypeColor?: string;
}

export default function PersonaCard({ persona, onEntityClick, entityTypeColor = '#007A87' }: PersonaCardProps) {
  return (
    <div
      className="card flex flex-col gap-3 transition-transform duration-150 hover:-translate-y-1"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
    >
      {/* Entity type badge */}
      <div>
        <span
          className="inline-block text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: entityTypeColor + '22', color: entityTypeColor }}
        >
          {persona.entity_type_label || 'Unknown Type'}
        </span>
      </div>

      {/* Persona name */}
      <div>
        <h3 className="text-xl font-bold text-[var(--text)] leading-tight">
          {persona.persona_name}
        </h3>
        <p className="text-sm italic text-[var(--text2)] mt-0.5">
          {persona.archetype_label}
        </p>
      </div>

      <hr className="border-[var(--border)]" />

      {/* Demographics */}
      <p className="text-sm text-[var(--text)] leading-relaxed">
        {persona.demographics}
      </p>

      {/* Motivations */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-1.5"
          style={{ color: 'var(--teal)', borderLeft: '3px solid var(--teal)', paddingLeft: 8 }}
        >
          Motivations
        </p>
        <ul className="space-y-1">
          {persona.motivations.map((m, i) => (
            <li key={i} className="text-sm text-[var(--text)] flex gap-2">
              <span className="mt-0.5 text-[var(--teal)] shrink-0">•</span>
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Frustrations */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-1.5"
          style={{ color: 'var(--coral)', borderLeft: '3px solid var(--coral)', paddingLeft: 8 }}
        >
          Frustrations
        </p>
        <ul className="space-y-1">
          {persona.frustrations.map((f, i) => (
            <li key={i} className="text-sm text-[var(--text)] flex gap-2">
              <span className="mt-0.5 text-[var(--coral)] shrink-0">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Based on */}
      {persona.representative_entities.length > 0 && (
        <div className="mt-auto pt-2 border-t border-[var(--border)]">
          <p className="text-xs font-mono text-[var(--text2)] mb-1">Based on:</p>
          <div className="flex flex-wrap gap-1.5">
            {persona.representative_entities.map((entity) => (
              <button
                key={entity.id}
                onClick={() => onEntityClick(entity.id)}
                className="text-xs font-mono underline text-[var(--accent)] hover:opacity-75 transition-opacity"
              >
                {entity.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PersonaCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3 animate-pulse">
      <div className="h-5 w-24 rounded bg-[var(--border)]" />
      <div className="space-y-2">
        <div className="h-6 w-3/4 rounded bg-[var(--border)]" />
        <div className="h-4 w-1/2 rounded bg-[var(--border)]" />
      </div>
      <hr className="border-[var(--border)]" />
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-[var(--border)]" />
        <div className="h-3 w-5/6 rounded bg-[var(--border)]" />
        <div className="h-3 w-4/6 rounded bg-[var(--border)]" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-1/3 rounded bg-[var(--border)]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-3 w-5/6 rounded bg-[var(--border)]" />
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-1/3 rounded bg-[var(--border)]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-3 w-5/6 rounded bg-[var(--border)]" />
        ))}
      </div>
    </div>
  );
}
