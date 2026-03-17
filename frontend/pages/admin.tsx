import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import EntityLabelsPanel from '@/components/admin/EntityLabelsPanel';
import RelationshipTypesPanel from '@/components/admin/RelationshipTypesPanel';
import {
  EntityLabelConfig,
  RelationshipTypeConfig,
  getEntityLabels,
  createEntityLabel,
  updateEntityLabel,
  deleteEntityLabel,
  getRelationshipTypes,
  createRelationshipType,
  updateRelationshipType,
  deleteRelationshipType,
  getStoredAuthToken,
  getStoredAuthUser,
} from '@/lib/api';

export default function AdminPage() {
  const router = useRouter();
  const [labels, setLabels] = useState<EntityLabelConfig[]>([]);
  const [types, setTypes] = useState<RelationshipTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const reload = async () => {
    setError('');
    const [labelRows, typeRows] = await Promise.all([
      getEntityLabels(),
      getRelationshipTypes(),
    ]);
    setLabels(labelRows);
    setTypes(typeRows);
  };

  useEffect(() => {
    (async () => {
      try {
        const token = getStoredAuthToken();
        const user = getStoredAuthUser();
        if (!token) {
          await router.replace('/login');
          return;
        }
        if (!user?.is_admin) {
          setError('Admin access is required to manage taxonomy.');
          setLoading(false);
          return;
        }

        setLoading(true);
        await reload();
      } catch (e: any) {
        setError(e.message || 'Failed to load admin taxonomy data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const wrap = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
      await reload();
    } catch (e: any) {
      setError(e.message || 'Admin action failed.');
    }
  };

  return (
    <Layout title="Admin" subtitle="Manage entity labels and relationship types used for extraction">
      <div className="space-y-6">
        {error && <ErrorMessage message={error} onRetry={() => void reload()} />}

        {loading ? (
          <div className="card flex items-center gap-3">
            <LoadingSpinner size="sm" />
            <span className="text-sm text-gray-600">Loading taxonomy configuration…</span>
          </div>
        ) : (
          <>
            <EntityLabelsPanel
              labels={labels}
              onCreate={(payload) => wrap(async () => { await createEntityLabel(payload); })}
              onUpdate={(id, payload) => wrap(async () => { await updateEntityLabel(id, payload); })}
              onDelete={(id) => wrap(async () => { await deleteEntityLabel(id); })}
            />

            <RelationshipTypesPanel
              types={types}
              onCreate={(payload) => wrap(async () => { await createRelationshipType(payload); })}
              onUpdate={(id, payload) => wrap(async () => { await updateRelationshipType(id, payload); })}
              onDelete={(id) => wrap(async () => { await deleteRelationshipType(id); })}
            />

            <div className="text-xs text-gray-500">
              Changes are applied to the next extraction run.
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
