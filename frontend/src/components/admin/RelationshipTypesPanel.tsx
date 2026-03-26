import React, { useState } from 'react';
import { RelationshipTypeConfig } from '@/lib/api';

interface Props {
  types: RelationshipTypeConfig[];
  onCreate: (payload: Omit<RelationshipTypeConfig, 'id'>) => Promise<void>;
  onUpdate: (id: string, payload: Partial<Omit<RelationshipTypeConfig, 'id'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  readOnly?: boolean;
}

const EMPTY_FORM: Omit<RelationshipTypeConfig, 'id'> = {
  name: '',
  description: '',
  directional: true,
  color: '#2563eb',
  active: true,
  display_order: 0,
};

function RelTypeRow({
  relType,
  onUpdate,
  onDelete,
}: {
  relType: RelationshipTypeConfig;
  onUpdate: (id: string, payload: Partial<Omit<RelationshipTypeConfig, 'id'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ ...relType });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty =
    draft.name !== relType.name ||
    draft.description !== relType.description ||
    draft.color !== relType.color ||
    draft.display_order !== relType.display_order ||
    draft.directional !== relType.directional ||
    draft.active !== relType.active;

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate(relType.id, {
        name: draft.name,
        description: draft.description,
        color: draft.color,
        display_order: draft.display_order,
        directional: draft.directional,
        active: draft.active,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 flex items-center gap-2 flex-wrap">
      <div
        style={{ width: 14, height: 14, borderRadius: 3, background: draft.color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.15)' }}
      />
      <input
        aria-label="Relationship type name"
        className="input-field"
        style={{ width: 130 }}
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <input
        aria-label="Relationship type description"
        className="input-field"
        style={{ flex: 1, minWidth: 100 }}
        placeholder="Description"
        value={draft.description || ''}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
      />
      <input
        aria-label="Color"
        title="Color"
        type="color"
        style={{ width: 36, height: 32, padding: 2, borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' }}
        value={draft.color}
        onChange={(e) => setDraft({ ...draft, color: e.target.value })}
      />
      <input
        aria-label="Display order"
        title="Display order"
        className="input-field"
        style={{ width: 60 }}
        type="number"
        min={0}
        value={draft.display_order}
        onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })}
      />
      <label className="inline-flex items-center gap-1 text-sm text-gray-600">
        <input type="checkbox" checked={draft.directional} onChange={(e) => setDraft({ ...draft, directional: e.target.checked })} />
        Directional
      </label>
      <label className="inline-flex items-center gap-1 text-sm text-gray-600">
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
        Active
      </label>
      {dirty && (
        <button
          type="button"
          className="btn-primary"
          style={{ fontSize: 12, padding: '4px 12px' }}
          disabled={saving || !draft.name.trim()}
          onClick={save}
        >
          {saving ? '…' : 'Save'}
        </button>
      )}
      <button
        type="button"
        className="btn-ghost"
        style={{ fontSize: 12, color: 'var(--coral, #f0614a)' }}
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          try { await onDelete(relType.id); } finally { setDeleting(false); }
        }}
      >
        {deleting ? '…' : 'Delete'}
      </button>
    </div>
  );
}

export default function RelationshipTypesPanel({ types, onCreate, onUpdate, onDelete, readOnly = false }: Props) {
  const [form, setForm] = useState<Omit<RelationshipTypeConfig, 'id'>>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await onCreate(form);
      setForm(EMPTY_FORM);
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-navy-700">Relationship Types</h2>
        <span className="text-xs text-gray-500">{types.length} total</span>
      </div>

      {!readOnly && (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-gray-50 rounded-lg">
          <input
            aria-label="New relationship type name"
            className="input-field"
            style={{ width: 130 }}
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            aria-label="New relationship type description"
            className="input-field"
            style={{ flex: 1, minWidth: 100 }}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            aria-label="New relationship type color"
            title="Color"
            type="color"
            style={{ width: 36, height: 32, padding: 2, borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' }}
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
          <input
            aria-label="New relationship type display order"
            title="Display order"
            className="input-field"
            style={{ width: 60 }}
            type="number"
            min={0}
            value={form.display_order}
            onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
          />
          <label className="inline-flex items-center gap-1 text-sm text-gray-600">
            <input type="checkbox" checked={form.directional} onChange={(e) => setForm({ ...form, directional: e.target.checked })} />
            Directional
          </label>
          <label className="inline-flex items-center gap-1 text-sm text-gray-600">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>
          <button type="submit" className="btn-primary" disabled={creating || !form.name.trim()}>
            {creating ? '…' : '+ Add'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {types.map((relType) =>
          readOnly ? (
            <div key={relType.id} className="flex items-center gap-3 p-2 rounded border border-gray-100">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: relType.color, flexShrink: 0 }} />
              <span className="text-sm font-medium" style={{ minWidth: 100 }}>{relType.name}</span>
              <span className="text-xs text-gray-400">{relType.description}</span>
            </div>
          ) : (
            <RelTypeRow key={relType.id} relType={relType} onUpdate={onUpdate} onDelete={onDelete} />
          )
        )}
      </div>
    </section>
  );
}
