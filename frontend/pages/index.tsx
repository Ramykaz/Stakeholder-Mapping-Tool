import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { getStoredAuthToken, getProjects, ProjectSummary } from '@/lib/api';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    const hasToken = !!getStoredAuthToken();
    setIsAuthenticated(hasToken);
    if (hasToken) {
      getProjects().then(setProjects).catch(() => setProjects([]));
    }
  }, []);

  return (
    <Layout title="Projects" subtitle="Create and manage stakeholder-analysis projects">
      <div className="mb-6 flex justify-end">
        {isAuthenticated ? (
          <Link href="/projects/new" className="btn-primary">New Project</Link>
        ) : (
          <Link href="/login" className="btn-primary">Login</Link>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}/workspace`} className="card hover:shadow-card-hover">
            <h3 className="text-base font-semibold text-navy-700">{project.name}</h3>
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{project.description || 'No description'}</p>
            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
              <span>{project.document_count} docs</span>
              <span>{project.entity_count} entities</span>
              <span className="capitalize">{project.status}</span>
            </div>
          </Link>
        ))}

        {projects.length === 0 && (
          <div className="card col-span-full text-center py-12">
            <p className="text-sm text-gray-500">No projects yet.</p>
            {isAuthenticated && (
              <Link href="/projects/new" className="text-primary-500 hover:text-primary-600 font-medium">
                Create your first project
              </Link>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
