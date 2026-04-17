import React, { useEffect, useState } from 'react';
import { saveProjectSMQAnswer, generateProjectSMQAnswer, ProjectSMQAnswer, renderLLMErrorMessage, SMQTemplateSection } from '@/lib/api';
import { replaceInitiativePlaceholders } from '@/lib/initiativeText';

interface SMQSectionProps {
  projectId: string;
  section: SMQTemplateSection;
  initiativeName?: string;
  existingAnswer?: ProjectSMQAnswer;
  aiEnabled: boolean;
  onUpdated: (sectionId: string, answer: ProjectSMQAnswer) => void;
}

export default function SMQSection({
  projectId,
  section,
  initiativeName = '',
  existingAnswer,
  aiEnabled,
  onUpdated,
}: SMQSectionProps) {
  const [value, setValue] = useState(existingAnswer?.answer_text || '');
  const [notes, setNotes] = useState(existingAnswer?.notes_text || '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [citations, setCitations] = useState<Array<{ doc_name: string; chunk_id: string; snippet: string }>>([]);

  useEffect(() => {
    setValue(existingAnswer?.answer_text || '');
    setNotes(existingAnswer?.notes_text || '');
  }, [existingAnswer?.answer_text, existingAnswer?.notes_text]);

  const onSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const updated = await saveProjectSMQAnswer(projectId, section.id, value, notes);
      onUpdated(section.id, updated);
      setMessage('Saved.');
    } catch {
      setMessage('Failed to save answer.');
    } finally {
      setSaving(false);
    }
  };

  const onGenerate = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const generated = await generateProjectSMQAnswer(projectId, section.id);
      const normalizedAnswer = replaceInitiativePlaceholders(generated.answer_text || '', initiativeName);
      setValue(normalizedAnswer);
      setCitations(generated.citations || []);
      onUpdated(section.id, {
        id: existingAnswer?.id || section.id,
        section_id: section.id,
        section_number: section.section_number,
        section_title: section.title,
        answer_text: normalizedAnswer,
        notes_text: generated.notes_text || notes,
        ai_generated: generated.ai_generated,
        is_stale: false,
        last_generated_at: null,
        chunk_ids_used: generated.chunk_ids_used || [],
      });
      setNotes(generated.notes_text || notes);
      setMessage('Generated with AI.');
    } catch (error) {
      setMessage(renderLLMErrorMessage(error, 'SMQ generation'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div>
        <h3 className="font-[var(--serif)] text-lg text-[var(--text)]">
          {section.section_number}. {section.title}
        </h3>
        <p className="text-xs text-[var(--text3)] mt-1 whitespace-pre-wrap">{replaceInitiativePlaceholders(section.question_prompts || '', initiativeName)}</p>
      </div>

      <textarea
        className="input-field min-h-[160px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Write your answer here or use Generate with AI"
        title={`SMQ section ${section.section_number} answer`}
        aria-label={`SMQ section ${section.section_number} answer`}
      />

      <label className="grid gap-1.5">
        <span className="text-xs text-[var(--text2)]">Section Notes (context for AI generation)</span>
        <textarea
          className="input-field min-h-[110px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add your notes, assumptions, constraints, and priorities for this section"
          title={`SMQ section ${section.section_number} notes`}
        />
      </label>

      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={() => void onSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn-ghost" onClick={() => void onGenerate()} disabled={!aiEnabled || generating}>
          {generating ? 'Generating…' : 'Generate with AI'}
        </button>
        {!aiEnabled && <span className="text-xs text-[var(--text3)]">No documents extracted yet.</span>}
      </div>

      {message && (
        <p className={`text-xs ${message.includes('failed') || message.includes('Failed') ? 'text-[var(--coral,#f0614a)]' : 'text-[var(--teal)]'}`}>
          {message}
        </p>
      )}

      {citations.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-[var(--text2)]">Citations</p>
          {citations.map((c, idx) => (
            <div key={`${c.chunk_id}-${idx}`} className="text-xs text-[var(--text3)]">
              [{c.doc_name}] {c.snippet}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
