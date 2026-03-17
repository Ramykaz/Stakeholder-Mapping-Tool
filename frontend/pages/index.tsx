import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { getStoredAuthToken } from '@/lib/api';

const features = [
  {
    title: 'Upload Documents',
    description: 'Upload PDF, DOCX, or TXT files for automated stakeholder extraction using AI.',
    href: '/upload',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    iconBg: 'bg-primary-50 text-primary-600',
    accent: 'group-hover:border-primary-300',
  },
  {
    title: 'Explore Entities',
    description: 'Browse extracted stakeholders — people, organizations, locations, and roles.',
    href: '/entities',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    iconBg: 'bg-emerald-50 text-emerald-600',
    accent: 'group-hover:border-emerald-300',
  },
  {
    title: 'Visualize Network',
    description: 'Interactive graph showing stakeholder entities and their co-occurrence patterns.',
    href: '/graph',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    iconBg: 'bg-violet-50 text-violet-600',
    accent: 'group-hover:border-violet-300',
  },
];

const steps = [
  {
    num: '01',
    title: 'Upload',
    description: 'Upload a PDF, DOCX, or TXT document. It gets chunked and embedded automatically.',
  },
  {
    num: '02',
    title: 'Extract',
    description: 'Groq Llama 3 identifies people, organizations, locations, and roles with confidence scores.',
  },
  {
    num: '03',
    title: 'Visualize',
    description: 'Explore the stakeholder network as an interactive graph powered by Cytoscape.js.',
  },
];

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(!!getStoredAuthToken());
  }, []);

  return (
    <Layout>
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-navy-700 text-white px-8 py-14 sm:px-12 sm:py-16 mb-8">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }} />
        </div>

        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px w-8 bg-accent-400" />
            <span className="text-accent-400 text-xs font-semibold uppercase tracking-widest">UNDP SDG AI Lab</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            <span className="text-accent-400">Stakeholder Analysis</span>
            <span className="block text-accent-400">Tool</span>
          </h1>
          <p className="mt-4 text-white/70 text-base leading-relaxed max-w-lg">
            Upload documents, extract named entities with AI, and visualize stakeholder networks — powered by Groq Llama&nbsp;3 and pgvector embeddings.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {isAuthenticated ? (
              <Link href="/upload" className="btn-primary !bg-accent-500 hover:!bg-accent-600 !text-navy-900 !font-semibold">
                Get Started
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            ) : (
              <Link href="/login" className="btn-primary !bg-accent-500 hover:!bg-accent-600 !text-navy-900 !font-semibold">
                Login
              </Link>
            )}
            <Link href="/graph" className="btn-ghost !text-white/80 hover:!text-white hover:!bg-white/10">
              View Demo Graph
            </Link>
          </div>
        </div>

        {/* Decorative element */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10 pointer-events-none">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="100" cy="30" r="8" fill="currentColor" />
            <circle cx="160" cy="80" r="10" fill="currentColor" />
            <circle cx="140" cy="160" r="6" fill="currentColor" />
            <circle cx="60" cy="140" r="9" fill="currentColor" />
            <circle cx="40" cy="70" r="7" fill="currentColor" />
            <line x1="100" y1="30" x2="160" y2="80" stroke="currentColor" strokeWidth="1" />
            <line x1="160" y1="80" x2="140" y2="160" stroke="currentColor" strokeWidth="1" />
            <line x1="140" y1="160" x2="60" y2="140" stroke="currentColor" strokeWidth="1" />
            <line x1="60" y1="140" x2="40" y2="70" stroke="currentColor" strokeWidth="1" />
            <line x1="40" y1="70" x2="100" y2="30" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-5 mb-10">
        {features.map((feat) => (
          <Link
            key={feat.href}
            href={feat.href}
            className={`card group cursor-pointer border-gray-200/80 ${feat.accent} hover:shadow-card-hover`}
          >
            <div className={`inline-flex p-2.5 rounded-lg ${feat.iconBg} mb-4`}>
              {feat.icon}
            </div>
            <h2 className="text-base font-semibold text-navy-700 group-hover:text-primary-600 transition-colors">
              {feat.title}
            </h2>
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{feat.description}</p>
            <span className="mt-3 inline-flex items-center text-sm font-medium text-primary-500 group-hover:text-primary-600 transition-colors">
              Open
              <svg className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      {/* How It Works — refined steps */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200/80">
          <h3 className="text-sm font-semibold text-navy-700 uppercase tracking-wider">How it works</h3>
        </div>
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {steps.map((step) => (
            <div key={step.num} className="px-6 py-5">
              <span className="text-2xl font-bold text-primary-100">{step.num}</span>
              <h4 className="mt-2 text-sm font-semibold text-navy-700">{step.title}</h4>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
