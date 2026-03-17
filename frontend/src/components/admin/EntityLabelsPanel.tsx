import React, { useState } from 'react';
import { EntityLabelConfig } from '@/lib/api';

interface Props {
  labels: EntityLabelConfig[];
  onCreate: (payload: Omit<EntityLabelConfig, 'id'>) => Promise<void>;
  onUpdate: (id: string, payload: Partial<Omit<EntityLabelConfig, 'id'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const SHAPES = ['ellipse', 'rectangle', 'diamond', 'hexagon', 'triangle', 'round-rectangle'];

const EMPTY_FORM: Omit<EntityLabelConfig, 'id'> = {
  name: '',
  description: '',
  node_shape: 'ellipse',
  color: '#2563eb',
  active: true,
  display_order: 0,
};

export default function EntityLabelsPanel({ labels, onCreate, onUpdate, onDelete }: Props) {
  const [form, setForm] = useState<Omit<EntityLabelConfig, 'id'>>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreate(form);
    setForm(EMPTY_FORM);
  };

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-navy-700">Entity Labels</h2>
        <span className="text-xs text-gray-500">{labels.length} total</span>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-5">
        <input aria-label="Entity label name" title="Entity label name" className="input-field md:col-span-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input aria-label="Entity label description" title="Entity label description" className="input-field md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select aria-label="Entity label shape" title="Entity label shape" className="input-field" value={form.node_shape} onChange={(e) => setForm({ ...form, node_shape: e.target.value })}>
          {SHAPES.map((shape) => <option key={shape} value={shape}>{shape}</option>)}
        </select>
        <input aria-label="Entity label color" title="Entity label color" className="input-field" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <input aria-label="Entity label display order" title="Entity label display order" className="input-field" type="number" min={0} value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Active
        </label>
        <button type="submit" className="btn-primary md:col-span-1">Add</button>
      </form>

      <div className="space-y-2">
        {labels.map((label) => (
          <div key={label.id} className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
            <input aria-label="Edit entity label name" title="Edit entity label name" className="input-field" value={label.name} onChange={(e) => onUpdate(label.id, { name: e.target.value })} />
            <input aria-label="Edit entity label description" title="Edit entity label description" className="input-field" value={label.description || ''} onChange={(e) => onUpdate(label.id, { description: e.target.value })} />
            <select aria-label="Edit entity label shape" title="Edit entity label shape" className="input-field" value={label.node_shape} onChange={(e) => onUpdate(label.id, { node_shape: e.target.value })}>
              {SHAPES.map((shape) => <option key={shape} value={shape}>{shape}</option>)}
            </select>
            <input aria-label="Edit entity label color" title="Edit entity label color" className="input-field w-16" type="color" value={label.color} onChange={(e) => onUpdate(label.id, { color: e.target.value })} />
            <input aria-label="Edit entity label display order" title="Edit entity label display order" className="input-field w-20" type="number" min={0} value={label.display_order} onChange={(e) => onUpdate(label.id, { display_order: Number(e.target.value) })} />
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={label.active} onChange={(e) => onUpdate(label.id, { active: e.target.checked })} />
              Active
            </label>
            <button
              type="button"
              className="btn-ghost text-red-600"
              disabled={busyId === label.id}
              onClick={async () => {
                setBusyId(label.id);
                try { await onDelete(label.id); } finally { setBusyId(null); }
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
