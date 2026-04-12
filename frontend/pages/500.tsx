import Link from 'next/link';
import Head from 'next/head';

export default function Custom500() {
  return (
    <>
      <Head>
        <title>Server Error — UNDP Stakeholder Analysis Tool</title>
      </Head>
      <main className="error-page-root">
        <section className="error-page-card">
          <p className="error-page-code">500</p>
          <h1 className="error-page-title">Server error</h1>
          <p className="error-page-message">An unexpected error occurred. Please try again.</p>
          <Link href="/" className="error-page-link">
            Return to home
          </Link>
        </section>
      </main>
    </>
  );
}
