import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'development',

    // Capture 10% of transactions for performance monitoring.
    tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Session replay — capture 1% of sessions, 100% of sessions with errors.
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        // Block sensitive form fields from being recorded.
        blockAllMedia: false,
        maskAllText: false,
        maskAllInputs: true,
      }),
    ],

    // Do not send PII by default.
    sendDefaultPii: false,
  });
}
