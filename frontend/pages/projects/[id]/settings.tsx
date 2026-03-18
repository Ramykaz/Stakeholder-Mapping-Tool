import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { deleteProject, getProject, getProjectConceptNote, updateProject, upsertProjectConceptNote } from '@/lib/api';

export default function ProjectSettingsPage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId)
      .then((p) => {
        setName(p.name);
        setDescription(p.description || '');
      })
      .catch(() => {
        setName('');
        setDescription('');
      });
    getProjectConceptNote(projectId).then((note) => setContent(note.content || '')).catch(() => setContent(''));
  }, [projectId]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    setMessage('');
    try {
      await updateProject(projectId, { name: name.trim(), description: description.trim() });
      await upsertProjectConceptNote(projectId, { content, attachment });
      setMessage('Saved');
    } catch (err: any) {
      setMessage(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;
    if (!window.confirm('Delete this project and all associated documents/entities?')) {
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await deleteProject(projectId);
      await router.push('/');
    } catch (err: any) {
      setMessage(err.message || 'Project deletion failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Project Settings" subtitle={name || 'Concept note configuration'}>
      <div className="max-w-2xl card space-y-4">
        <input
          type="text"
          className="input-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
        />
        <textarea
          className="input-field min-h-[100px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Project description"
        />
        <textarea
          className="input-field min-h-[180px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Update concept note"
        />
        <input
          type="file"
          className="input-field"
          title="Concept note attachment"
          onChange={(e) => setAttachment(e.target.files?.[0] || null)}
        />
        {message && <p className="text-sm text-gray-600">{message}</p>}
        <div className="flex items-center gap-3">
          <button onClick={() => void handleSave()} disabled={saving} className="btn-primary w-fit">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={() => void handleDeleteProject()} disabled={saving} className="btn-ghost text-red-600 w-fit">
            Delete Project
          </button>
        </div>
      </div>
    </Layout>
  );
}
