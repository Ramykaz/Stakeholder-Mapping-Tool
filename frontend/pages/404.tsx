import Link from 'next/link';
import Head from 'next/head';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>Page Not Found — UNDP Stakeholder Analysis Tool</title>
      </Head>
      <main className="error-page-root">
        <section className="error-page-card">
          <p className="error-page-code">404</p>
          <h1 className="error-page-title">Page not found</h1>
          <p className="error-page-message">The page you requested does not exist.</p>
          <Link href="/" className="error-page-link">
            Return to home
          </Link>
        </section>
      </main>
    </>
  );
}
