// frontend-next/src/app/sitemap-actors.xml/route.js
export const runtime = 'nodejs';
export const revalidate = 3600;

const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api-hi.moviefrost.com';

const API_BASE = String(RAW_API_BASE)
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '')
  .replace(/^([^h][^t][^t][^p].*)$/i, 'https://$1');

const SITE_URL = String(
  process.env.NEXT_PUBLIC_SITE_URL || 'https://hi.moviefrost.com'
).replace(/\/+$/, '');

const escapeXml = (unsafe = '') =>
  String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const headers = {
  'Content-Type': 'application/xml; charset=UTF-8',
  'Cache-Control':
    'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
};

export async function GET() {
  let actors = [];

  try {
    const res = await fetch(`${API_BASE}/api/actors/sitemap?limit=50000`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      actors = Array.isArray(data?.actors) ? data.actors : [];
    }
  } catch {
    actors = [];
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${actors
      .filter((item) => item?.slug)
      .map((item) => {
        const loc = `${SITE_URL}/actor/${encodeURIComponent(item.slug)}`;
        const lastmod = item.lastmod ? new Date(item.lastmod).toISOString() : '';

        return `  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
      })
      .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers,
  });
}
