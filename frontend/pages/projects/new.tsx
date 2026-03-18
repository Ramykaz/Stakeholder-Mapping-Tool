import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { createProject, upsertProjectConceptNote } from '@/lib/api';

type WizardStep = 'name' | 'description' | 'concept' | 'review' | 'creating' | 'done';

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('name');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const timeline = useMemo(() => {
    return [
      { from: 'assistant', text: 'Let’s create a new project workspace.' },
      { from: 'assistant', text: 'What should this project be called?' },
      ...(name ? [{ from: 'user', text: name }] : []),
      ...(name ? [{ from: 'assistant', text: 'Great. Add a short description (or skip).' }] : []),
      ...(description ? [{ from: 'user', text: description }] : []),
      ...(name ? [{ from: 'assistant', text: 'Now add concept note context to guide extraction.' }] : []),
      ...(content ? [{ from: 'user', text: content.length > 160 ? `${content.slice(0, 160)}…` : content }] : []),
      ...(attachment ? [{ from: 'user', text: `Attached file: ${attachment.name}` }] : []),
    ];
  }, [name, description, content, attachment]);

  const submitCurrentStep = async () => {
    setError('');

    if (step === 'name') {
      const value = input.trim();
      if (!value) {
        setError('Project name is required.');
        return;
      }
      setName(value);
      setInput('');
      setStep('description');
      return;
    }

    if (step === 'description') {
      setDescription(input.trim());
      setInput('');
      setStep('concept');
      return;
    }

    if (step === 'concept') {
      setContent(input.trim());
      setInput('');
      setStep('review');
      return;
    }

    if (step !== 'review') {
      return;
    }

    setSaving(true);
    setStep('creating');
    try {
      const project = await createProject({ name: name.trim(), description: description.trim() });
      await upsertProjectConceptNote(project.id, { content, attachment });
      setStep('done');
      await router.push(`/projects/${project.id}/workspace`);
    } catch (err: any) {
      setError(err.message || 'Failed to create project.');
      setStep('review');
    } finally {
      setSaving(false);
    }
  };

  const assistantPrompt =
    step === 'name'
      ? 'Enter project name'
      : step === 'description'
        ? 'Describe the project (optional)'
        : step === 'concept'
          ? 'Paste concept note text (optional)'
          : step === 'review'
            ? 'Review details and create project'
            : step === 'creating'
              ? 'Creating project...'
              : 'Done';

  return (
    <Layout title="Create Project" subtitle="Guided AI-style workspace setup">
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        <div className="card min-h-[540px] flex flex-col">
          <div className="space-y-3 flex-1 overflow-auto pr-1">
            {timeline.map((entry, idx) => (
              <div
                key={`${entry.from}-${idx}`}
                className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${
                  entry.from === 'assistant'
                    ? 'bg-gray-100 text-gray-700'
                    : 'ml-auto bg-primary-500 text-white'
                }`}
              >
                {entry.text}
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{assistantPrompt}</p>

            {step !== 'review' && step !== 'creating' && (
              <textarea
                className="input-field min-h-[96px]"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={assistantPrompt}
              />
            )}

            {(step === 'concept' || step === 'review') && (
              <input
                type="file"
                title="Concept note attachment"
                className="input-field"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void submitCurrentStep()}
                className="btn-primary"
                disabled={saving || step === 'creating' || step === 'done'}
              >
                {step === 'review' ? (saving ? 'Creating…' : 'Create Project') : 'Continue'}
              </button>
              {step === 'description' && (
                <button
                  type="button"
                  onClick={() => {
                    setDescription('');
                    setInput('');
                    setStep('concept');
                  }}
                  className="btn-ghost"
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card h-fit">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy-700 mb-3">Preview</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p><span className="font-medium text-gray-800">Name:</span> {name || '—'}</p>
            <p><span className="font-medium text-gray-800">Description:</span> {description || '—'}</p>
            <p><span className="font-medium text-gray-800">Concept note:</span> {content ? `${content.slice(0, 120)}${content.length > 120 ? '…' : ''}` : '—'}</p>
            <p><span className="font-medium text-gray-800">Attachment:</span> {attachment?.name || 'None'}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
