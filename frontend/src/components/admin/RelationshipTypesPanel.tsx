import React, { useState } from 'react';
import { RelationshipTypeConfig } from '@/lib/api';

interface Props {
  types: RelationshipTypeConfig[];
  onCreate: (payload: Omit<RelationshipTypeConfig, 'id'>) => Promise<void>;
  onUpdate: (id: string, payload: Partial<Omit<RelationshipTypeConfig, 'id'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY_FORM: Omit<RelationshipTypeConfig, 'id'> = {
  name: '',
  description: '',
  directional: true,
  color: '#2563eb',
  active: true,
  display_order: 0,
};

export default function RelationshipTypesPanel({ types, onCreate, onUpdate, onDelete }: Props) {
  const [form, setForm] = useState<Omit<RelationshipTypeConfig, 'id'>>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreate(form);
    setForm(EMPTY_FORM);
  };

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-navy-700">Relationship Types</h2>
        <span className="text-xs text-gray-500">{types.length} total</span>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-5">
        <input aria-label="Relationship type name" title="Relationship type name" className="input-field md:col-span-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input aria-label="Relationship type description" title="Relationship type description" className="input-field md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input aria-label="Relationship type color" title="Relationship type color" className="input-field" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <input aria-label="Relationship type display order" title="Relationship type display order" className="input-field" type="number" min={0} value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.directional} onChange={(e) => setForm({ ...form, directional: e.target.checked })} />
          Directional
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Active
        </label>
        <button type="submit" className="btn-primary md:col-span-1">Add</button>
      </form>

      <div className="space-y-2">
        {types.map((relType) => (
          <div key={relType.id} className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
            <input aria-label="Edit relationship type name" title="Edit relationship type name" className="input-field" value={relType.name} onChange={(e) => onUpdate(relType.id, { name: e.target.value })} />
            <input aria-label="Edit relationship type description" title="Edit relationship type description" className="input-field" value={relType.description || ''} onChange={(e) => onUpdate(relType.id, { description: e.target.value })} />
            <input aria-label="Edit relationship type color" title="Edit relationship type color" className="input-field w-16" type="color" value={relType.color} onChange={(e) => onUpdate(relType.id, { color: e.target.value })} />
            <input aria-label="Edit relationship type display order" title="Edit relationship type display order" className="input-field w-20" type="number" min={0} value={relType.display_order} onChange={(e) => onUpdate(relType.id, { display_order: Number(e.target.value) })} />
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={relType.directional} onChange={(e) => onUpdate(relType.id, { directional: e.target.checked })} />
              Directional
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={relType.active} onChange={(e) => onUpdate(relType.id, { active: e.target.checked })} />
              Active
            </label>
            <button
              type="button"
              className="btn-ghost text-red-600"
              disabled={busyId === relType.id}
              onClick={async () => {
                setBusyId(relType.id);
                try { await onDelete(relType.id); } finally { setBusyId(null); }
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
