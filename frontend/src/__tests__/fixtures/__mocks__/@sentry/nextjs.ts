/* Jest mock for @sentry/nextjs — prevents jsdom crashes from browser-only performance APIs */
const captureException = jest.fn();
const captureMessage = jest.fn();
const addBreadcrumb = jest.fn();
const init = jest.fn();
const withSentryConfig = (config: unknown) => config;
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => children;

export {
  captureException,
  captureMessage,
  addBreadcrumb,
  init,
  withSentryConfig,
  ErrorBoundary,
};

export default {
  captureException,
  captureMessage,
  addBreadcrumb,
  init,
  withSentryConfig,
  ErrorBoundary,
};
