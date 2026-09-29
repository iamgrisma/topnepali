import type { APIRoute } from 'astro';
import { getPosts, getCategories } from '../lib/wp';
import { SITE_URL } from '../config';

export const GET: APIRoute = async () => {
  const siteUrl = SITE_URL;

  const [postsResult, categories] = await Promise.all([
    getPosts({ perPage: 100 }),
    getCategories({ perPage: 50, hideEmpty: true }),
  ]);

  const now = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: `${siteUrl}/`, priority: '1.0', changefreq: 'daily', lastmod: now },
    { loc: `${siteUrl}/search`, priority: '0.6', changefreq: 'weekly', lastmod: now },
    { loc: `${siteUrl}/privacy`, priority: '0.4', changefreq: 'yearly', lastmod: now },
  ];

  const categoryUrls = categories.map((cat) => ({
    loc: `${siteUrl}/category/${cat.slug}`,
    priority: '0.8',
    changefreq: 'daily',
    lastmod: now,
  }));

  const postUrls = postsResult.data.map((post) => ({
    loc: `${siteUrl}/${post.slug}`,
    priority: '0.9',
    changefreq: 'weekly',
    lastmod: (post.modified_gmt || post.date_gmt || post.date || now).split('T')[0],
  }));

  const allUrls = [...staticUrls, ...categoryUrls, ...postUrls];

  const xmlEntries = allUrls
    .map(
      (item) => `  <url>
    <loc>${item.loc}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
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
