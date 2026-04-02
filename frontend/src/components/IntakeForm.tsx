import React, { useEffect, useMemo, useState } from 'react';
import {
  getProjectIntake,
  upsertProjectIntake,
  InitiativeProfileResponse,
} from '@/lib/api';

interface IntakeFormProps {
  projectId: string;
}

const EMPTY_PROFILE: InitiativeProfileResponse = {
  id: null,
  project: '',
  initiative_name: '',
  geography: '',
  thematic_area: '',
  core_objectives: '',
  expected_outcomes: '',
  stakeholder_focus: '',
  updated_at: null,
};

export default function IntakeForm({ projectId }: IntakeFormProps) {
  const [profile, setProfile] = useState<InitiativeProfileResponse>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProjectIntake(projectId)
      .then((data) => setProfile(data))
      .catch(() => setMessage('Failed to load initiative profile.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const mandatoryMissing = useMemo(() => {
    const required = [
      profile.initiative_name,
      profile.geography,
      profile.thematic_area,
      profile.core_objectives,
      profile.expected_outcomes,
      profile.stakeholder_focus,
    ];
    return required.some((value) => !value?.trim());
  }, [profile]);

  const setField = (key: keyof InitiativeProfileResponse, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setMessage('');
  };

  const onSave = async () => {
    if (mandatoryMissing) {
      setMessage('Please fill all required fields before saving.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const saved = await upsertProjectIntake(projectId, {
        initiative_name: profile.initiative_name,
        geography: profile.geography,
        thematic_area: profile.thematic_area,
        core_objectives: profile.core_objectives,
        expected_outcomes: profile.expected_outcomes,
        stakeholder_focus: profile.stakeholder_focus,
      });
      setProfile(saved);
      setMessage('Initiative profile saved.');
    } catch {
      setMessage('Failed to save initiative profile.');
    } finally {
      setSaving(false);
    }
  };

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
        <span className="text-xs text-[var(--text2)]">Initiative Name *</span>
        <input
          className="input-field"
          value={profile.initiative_name}
          onChange={(e) => setField('initiative_name', e.target.value)}
          placeholder="AI for Good Hackathon"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs text-[var(--text2)]">Geography / Country Context *</span>
        <input
          className="input-field"
          value={profile.geography}
          onChange={(e) => setField('geography', e.target.value)}
          placeholder="Uzbekistan, Central Asia"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs text-[var(--text2)]">Thematic Area *</span>
        <input
          className="input-field"
          value={profile.thematic_area}
          onChange={(e) => setField('thematic_area', e.target.value)}
          placeholder="Youth Employment"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs text-[var(--text2)]">Core Objectives *</span>
        <textarea
          className="input-field min-h-[140px]"
          value={profile.core_objectives}
          onChange={(e) => setField('core_objectives', e.target.value)}
          placeholder="Describe the initiative mission and objectives"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs text-[var(--text2)]">Expected Outcomes *</span>
        <textarea
          className="input-field min-h-[140px]"
          value={profile.expected_outcomes}
          onChange={(e) => setField('expected_outcomes', e.target.value)}
          placeholder="Describe expected outcomes and measurable success"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs text-[var(--text2)]">Stakeholder Focus *</span>
        <textarea
          className="input-field min-h-[120px]"
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

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => void onSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Initiative Profile'}
        </button>
      </div>
    </div>
  );
}
