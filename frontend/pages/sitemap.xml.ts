import type { GetServerSideProps } from 'next';

function buildSitemap(siteUrl: string): string {
  const pages = ['/', '/login', '/forgot-password', '/reset-password', '/upload', '/entities'];
  const urls = pages
    .map((path) => `<url><loc>${siteUrl}${path}</loc><changefreq>weekly</changefreq></url>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const body = buildSitemap(siteUrl);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.write(body);
  res.end();

  return { props: {} };
};

export default function SitemapXml() {
  return null;
}
