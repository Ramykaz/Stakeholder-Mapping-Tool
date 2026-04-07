import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getProjectContextPreview,
  getProjectIntake,
  upsertProjectIntake,
  InitiativeProfileResponse,
} from '@/lib/api';

interface IntakeFormProps {
  projectId: string;
  onDirtyChange?: (dirty: boolean) => void;
}

const EMPTY_PROFILE: InitiativeProfileResponse = {
  id: null,
  project: '',
  initiative_name: '',
  host_organization: '',
  country: '',
  geography: '',
  thematic_area: '',
  core_objectives: '',
  expected_outcomes: '',
  target_beneficiaries: '',
  success_metrics: '',
  stakeholder_focus: '',
  updated_at: null,
};

export default function IntakeForm({ projectId, onDirtyChange }: IntakeFormProps) {
  const [profile, setProfile] = useState<InitiativeProfileResponse>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [contextPreview, setContextPreview] = useState('');
  const [baseline, setBaseline] = useState<InitiativeProfileResponse>(EMPTY_PROFILE);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProjectIntake(projectId)
      .then(async (data) => {
        setProfile(data);
        setBaseline(data);
        const preview = await getProjectContextPreview(projectId);
        setContextPreview(preview.context || '');
      })
      .catch(() => setMessage('Failed to load initiative profile.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const autosavePayload = useMemo(() => ({
    initiative_name: profile.initiative_name,
    host_organization: profile.host_organization,
    country: profile.country,
    geography: profile.geography,
    thematic_area: profile.thematic_area,
    core_objectives: profile.core_objectives,
    expected_outcomes: profile.expected_outcomes,
    target_beneficiaries: profile.target_beneficiaries,
    success_metrics: profile.success_metrics,
    stakeholder_focus: profile.stakeholder_focus,
  }), [profile]);

  const setField = (key: keyof InitiativeProfileResponse, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setMessage('');
  };

  const isDirty = useMemo(
    () => JSON.stringify(autosavePayload) !== JSON.stringify({
      initiative_name: baseline.initiative_name,
      host_organization: baseline.host_organization,
      country: baseline.country,
      geography: baseline.geography,
      thematic_area: baseline.thematic_area,
      core_objectives: baseline.core_objectives,
      expected_outcomes: baseline.expected_outcomes,
      target_beneficiaries: baseline.target_beneficiaries,
      success_metrics: baseline.success_metrics,
      stakeholder_focus: baseline.stakeholder_focus,
    }),
    [autosavePayload, baseline]
  );

  const canSave = Boolean((profile.initiative_name || '').trim()) && isDirty && !saving;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const onSave = useCallback(async (silent = false) => {
    setSaving(true);
    if (!silent) {
      setMessage('');
    }

    try {
      const saved = await upsertProjectIntake(projectId, autosavePayload);
      setProfile(saved);
      setBaseline(saved);
      const preview = await getProjectContextPreview(projectId);
      setContextPreview(preview.context || '');
      if (!silent) {
        setMessage('Initiative profile saved.');
      }
    } catch {
      if (!silent) {
        setMessage('Failed to save initiative profile.');
      }
    } finally {
      setSaving(false);
    }
  }, [autosavePayload, projectId]);

  if (loading) {
    return <div className="text-sm text-[var(--text3)]">Loading initiative profile…</div>;
  }

  return (
    <div className="card mx-auto grid max-w-[860px] gap-3.5">
      <div>
        <h2 className="font-[var(--serif)] text-2xl text-[var(--text)]">Initiative Profile</h2>
        <p className="mt-1.5 text-sm text-[var(--text2)]">
          This profile is editable at any time and is used as project context for extraction and reporting.
        </p>
      </div>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Initiative Title</span>
        <input
          className="input-field text-sm"
          value={profile.initiative_name}
          onChange={(e) => setField('initiative_name', e.target.value)}
          placeholder="AI for Good Hackathon"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Host Organisation</span>
        <input
          className="input-field text-sm"
          value={profile.host_organization}
          onChange={(e) => setField('host_organization', e.target.value)}
          placeholder="UNDP SDG AI Lab"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Country</span>
        <input
          className="input-field text-sm"
          value={profile.country}
          onChange={(e) => setField('country', e.target.value)}
          placeholder="Uzbekistan"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Geography / Country Context</span>
        <input
          className="input-field text-sm"
          value={profile.geography}
          onChange={(e) => setField('geography', e.target.value)}
          placeholder="Uzbekistan, Central Asia"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Thematic Area</span>
        <input
          className="input-field text-sm"
          value={profile.thematic_area}
          onChange={(e) => setField('thematic_area', e.target.value)}
          placeholder="Youth Employment"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Core Objectives</span>
        <textarea
          className="input-field min-h-[140px] text-sm"
          value={profile.core_objectives}
          onChange={(e) => setField('core_objectives', e.target.value)}
          placeholder="Describe the initiative mission and objectives"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Expected Outcomes</span>
        <textarea
          className="input-field min-h-[140px] text-sm"
          value={profile.expected_outcomes}
          onChange={(e) => setField('expected_outcomes', e.target.value)}
          placeholder="Describe expected outcomes and measurable success"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Target Beneficiaries</span>
        <textarea
          className="input-field min-h-[120px] text-sm"
          value={profile.target_beneficiaries}
          onChange={(e) => setField('target_beneficiaries', e.target.value)}
          placeholder="Primary groups that should benefit"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Success Metrics</span>
        <textarea
          className="input-field min-h-[120px] text-sm"
          value={profile.success_metrics}
          onChange={(e) => setField('success_metrics', e.target.value)}
          placeholder="How success will be measured"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-[var(--text2)]">Stakeholder Focus</span>
        <textarea
          className="input-field min-h-[120px] text-sm"
          value={profile.stakeholder_focus}
          onChange={(e) => setField('stakeholder_focus', e.target.value)}
          placeholder="Describe priority stakeholder groups to focus on"
        />
      </label>

      {message && (
        <div className={`text-xs ${message.includes('Failed') ? 'text-[var(--coral,#f0614a)]' : 'text-[var(--teal)]'}`}>
          {message}
        </div>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-3">
        <p className="text-xs text-[var(--text2)] mb-1">Live LLM Context Preview (exact backend context)</p>
        <pre className="text-xs text-[var(--text3)] whitespace-pre-wrap">{contextPreview || 'No context available yet.'}</pre>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => void onSave()} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save Initiative Profile'}
        </button>
      </div>
    </div>
  );
}
