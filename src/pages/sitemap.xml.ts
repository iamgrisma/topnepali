import type { APIRoute } from 'astro';
import { getAllPostsForSitemap, getCategories } from '../lib/wp';
import { SITE_URL } from '../config';

function escapeXml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const siteUrl = SITE_URL.replace(/\/+$/, '');

  const [postsAndPages, categories] = await Promise.all([
    getAllPostsForSitemap(),
    getCategories({ perPage: 100, hideEmpty: true }),
  ]);

  const now = new Date().toISOString().split('T')[0];

  // Core static and landing pages (excluding dynamic search)
  const staticUrls = [
    { loc: `${siteUrl}/`, priority: '1.0', changefreq: 'daily', lastmod: now },
    { loc: `${siteUrl}/blogs`, priority: '0.9', changefreq: 'daily', lastmod: now },
    { loc: `${siteUrl}/tools`, priority: '0.8', changefreq: 'weekly', lastmod: now },
    { loc: `${siteUrl}/nepali-date-converter`, priority: '0.8', changefreq: 'weekly', lastmod: now },
    { loc: `${siteUrl}/foreign-exchange-rates-for-nepali-currency`, priority: '0.8', changefreq: 'daily', lastmod: now },
    { loc: `${siteUrl}/nepali-calendar`, priority: '0.8', changefreq: 'weekly', lastmod: now },
    { loc: `${siteUrl}/nepali-rashifal-horoscope`, priority: '0.8', changefreq: 'daily', lastmod: now },
    { loc: `${siteUrl}/about-us`, priority: '0.5', changefreq: 'monthly', lastmod: now },
    { loc: `${siteUrl}/contact`, priority: '0.5', changefreq: 'monthly', lastmod: now },
    { loc: `${siteUrl}/privacy`, priority: '0.3', changefreq: 'yearly', lastmod: now },
    { loc: `${siteUrl}/terms-and-conditions`, priority: '0.3', changefreq: 'yearly', lastmod: now },
  ];

  const categoryUrls = categories.map((cat) => ({
    loc: `${siteUrl}/category/${cat.slug}`,
    priority: '0.7',
    changefreq: 'daily',
    lastmod: now,
  }));

  // Unique posts and pages from WordPress
  const postUrls: Array<{ loc: string; priority: string; changefreq: string; lastmod: string }> = [];
  const seenSlugs = new Set(staticUrls.map((s) => s.loc.replace(`${siteUrl}/`, '')));

  for (const item of postsAndPages) {
    if (!item.slug || seenSlugs.has(item.slug)) continue;
    seenSlugs.add(item.slug);

    postUrls.push({
      loc: `${siteUrl}/${item.slug}`,
      priority: '0.9',
      changefreq: 'weekly',
      lastmod: item.lastmod || now,
    });
  }

  const allUrls = [...staticUrls, ...categoryUrls, ...postUrls];

  const xmlEntries = allUrls
    .map(
      (item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <lastmod>${escapeXml(item.lastmod)}</lastmod>
    <changefreq>${escapeXml(item.changefreq)}</changefreq>
    <priority>${escapeXml(item.priority)}</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200',
      'Cloudflare-CDN-Cache-Control': 'max-age=86400, stale-while-revalidate=43200',
    },
  });
};
