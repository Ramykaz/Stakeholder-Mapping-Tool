import React from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';

const features = [
  {
    title: 'Upload Documents',
    description: 'Upload PDF, DOCX, or TXT files for automated stakeholder extraction.',
    href: '/upload',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    color: 'text-blue-600 bg-blue-50',
  },
  {
    title: 'View Entities',
    description: 'Browse extracted stakeholders: people, organizations, locations, and roles.',
    href: '/entities',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: 'text-green-600 bg-green-50',
  },
  {
    title: 'Graph Visualization',
    description: 'Interactive network graph showing stakeholders and their relationships.',
    href: '/graph',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    color: 'text-purple-600 bg-purple-50',
  },
];

export default function Home() {
  return (
    <Layout>
      {/* Hero */}
      <div className="text-center py-12">
        <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
          Stakeholder Analysis Tool
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          Upload documents, extract named entities with AI, and visualize stakeholder networks —
          powered by Groq Llama&nbsp;3 and pgvector embeddings.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid md:grid-cols-3 gap-6 mt-4">
        {features.map((feat) => (
          <Link key={feat.href} href={feat.href} className="card group cursor-pointer">
            <div className={`inline-flex p-3 rounded-lg ${feat.color} mb-4`}>
              {feat.icon}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
              {feat.title}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{feat.description}</p>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-700">
              Get started
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      {/* Quick info */}
      <div className="mt-16 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">How it works</h3>
        <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600">
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">1</span>
            <p><strong className="text-gray-900">Upload</strong> a PDF, DOCX, or TXT document. It gets chunked and embedded automatically.</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">2</span>
            <p><strong className="text-gray-900">Extract</strong> entities — Groq Llama 3 identifies people, organizations, locations, and roles.</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">3</span>
            <p><strong className="text-gray-900">Visualize</strong> the stakeholder network as an interactive graph with Cytoscape.js.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
