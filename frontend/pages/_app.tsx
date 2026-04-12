
import React from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import '@/styles/globals.css';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="UNDP Stakeholder Analysis Tool for extracting entities, mapping relationships, and generating evidence-based insights." />
        <meta property="og:title" content="UNDP Stakeholder Analysis Tool" />
        <meta property="og:description" content="Analyze stakeholders with extraction, graph views, and project reporting workflows." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <title>UNDP Stakeholder Analysis Tool</title>
      </Head>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </>
  );
}
