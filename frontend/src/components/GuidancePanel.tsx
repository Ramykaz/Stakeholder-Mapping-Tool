import React, { useEffect, useMemo, useState } from 'react';
import {
  createProjectGuidance,
  deleteProjectGuidance,
  getProjectGuidance,
  reorderProjectGuidance,
  updateProjectGuidance,
  ExtractionGuidanceItem,
} from '@/lib/api';

interface GuidancePanelProps {
  projectId: string;
}

export default function GuidancePanel({ projectId }: GuidancePanelProps) {
  const [items, setItems] = useState<ExtractionGuidanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newText, setNewText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProjectGuidance(projectId)
      .then((res) => setItems(res.results || []))
      .catch(() => setMessage('Failed to load extraction guidance.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const canAdd = useMemo(() => newText.trim().length > 0 && !saving, [newText, saving]);

  const onAdd = async () => {
    if (!canAdd) return;
    setSaving(true);
    setMessage('');
    try {
      const created = await createProjectGuidance(projectId, { text: newText.trim() });
      setItems((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setNewText('');
      setMessage('Guidance saved.');
    } catch {
      setMessage('Failed to save guidance.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    setSaving(true);
    setMessage('');
    try {
      await deleteProjectGuidance(projectId, id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setMessage('Guidance deleted.');
    } catch {
      setMessage('Failed to delete guidance.');
    } finally {
      setSaving(false);
    }
  };

  const onEdit = async (id: number, text: string) => {
    setSaving(true);
    setMessage('');
    try {
      const updated = await updateProjectGuidance(projectId, id, { text: text.trim() });
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setMessage('Guidance updated.');
    } catch {
      setMessage('Failed to update guidance.');
    } finally {
      setSaving(false);
    }
  };

  const onMove = async (id: number, direction: 'up' | 'down') => {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    const orderIds = reordered.map((item) => item.id);

    setSaving(true);
    setMessage('');
    try {
      await reorderProjectGuidance(projectId, orderIds);
      setItems(reordered.map((item, idx) => ({ ...item, order: idx })));
      setMessage('Guidance order updated.');
    } catch {
      setMessage('Failed to reorder guidance.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[var(--text3)]">Loading extraction guidance…</div>;
  }

  return (
    <div className="max-w-2xl card space-y-4 mt-4">
      <h2 className="font-[var(--serif)] text-lg text-[var(--text)]">Extraction Guidance</h2>
      <p className="text-sm text-[var(--text3)]">
        Add project-specific instructions to steer extraction focus and relationship interpretation.
      </p>

      <div className="flex gap-2">
        <input
          className="input-field"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="e.g., Prioritize public institutions and funding relationships"
        />
        <button className="btn-primary" disabled={!canAdd} onClick={() => void onAdd()}>
          Add
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <GuidanceRow
            key={item.id}
            item={item}
            disableUp={index === 0 || saving}
            disableDown={index === items.length - 1 || saving}
            onMove={onMove}
            onDelete={onDelete}
            onEdit={onEdit}
            disabled={saving}
          />
        ))}
        {items.length === 0 && <div className="text-xs text-[var(--text3)]">No guidance added yet.</div>}
      </div>

      {message && (
        <p className={`text-xs ${message.includes('Failed') ? 'text-[var(--coral,#f0614a)]' : 'text-[var(--teal)]'}`}>
          {message}
        </p>
      )}
    </div>
  );
}

function GuidanceRow({
  item,
  disableUp,
  disableDown,
  disabled,
  onMove,
  onDelete,
  onEdit,
}: {
  item: ExtractionGuidanceItem;
  disableUp: boolean;
  disableDown: boolean;
  disabled: boolean;
  onMove: (id: number, direction: 'up' | 'down') => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onEdit: (id: number, text: string) => Promise<void>;
}) {
  const [value, setValue] = useState(item.text);

  useEffect(() => {
    setValue(item.text);
  }, [item.text]);

  return (
    <div className="grid gap-2 rounded-lg border border-[var(--border)] p-2">
      <textarea
        className="input-field min-h-[76px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        title="Edit guidance item"
        placeholder="Enter extraction guidance"
      />
      <div className="flex items-center gap-2 justify-end">
        <button className="btn-ghost" disabled={disableUp} onClick={() => void onMove(item.id, 'up')}>
          Move Up
        </button>
        <button className="btn-ghost" disabled={disableDown} onClick={() => void onMove(item.id, 'down')}>
          Move Down
        </button>
        <button
          className="btn-ghost"
          disabled={disabled || !value.trim() || value.trim() === item.text.trim()}
          onClick={() => void onEdit(item.id, value)}
        >
          Save
        </button>
        <button className="btn-ghost text-red-600" disabled={disabled} onClick={() => void onDelete(item.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}
