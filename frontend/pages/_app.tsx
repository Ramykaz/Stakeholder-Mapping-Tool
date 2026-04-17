import React from 'react';
import type { AppProps } from 'next/app';
import type { NextWebVitalsMetric } from 'next/app';
import Head from 'next/head';
import '@/styles/globals.css';
import ErrorBoundary from '@/components/ErrorBoundary';

export function reportWebVitals(metric: NextWebVitalsMetric): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[WebVitals]', metric.name, metric.value.toFixed(2));
  }

  // In production, forward Web Vitals to Sentry as measurements.
  if (process.env.NODE_ENV === 'production') {
    try {
      const Sentry = require('@sentry/nextjs');
      Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond');
    } catch {
      // Sentry not available
    }
  }
}

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
      <ErrorBoundary label="app-root">
        <Component {...pageProps} />
      </ErrorBoundary>
    </>
  );
}
