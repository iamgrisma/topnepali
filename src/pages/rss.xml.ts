import type { APIRoute } from 'astro';
import { getPosts, getSiteInfo } from '../lib/wp';
import { SITE_URL } from '../config';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const siteUrl = SITE_URL;
  const siteInfo = getSiteInfo();
  const postsResult = await getPosts({ perPage: 20 });

  const items = postsResult.data
    .map((post) => {
      const postUrl = `${siteUrl}/${post.slug}`;
      const pubDate = new Date(post.date_gmt || post.date).toUTCString();
      const title = escapeXml(post.title?.rendered || 'Untitled');
      const excerpt = escapeXml(
        (post.excerpt?.rendered || post.content?.rendered || '')
          .replace(/<[^>]*>/g, '')
          .trim()
          .slice(0, 300)
      );

      return `    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${excerpt}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteInfo.name || 'Top Nepali')}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(siteInfo.description || 'Top Nepali Digital Feed')}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200',
      'Cloudflare-CDN-Cache-Control': 'max-age=86400, stale-while-revalidate=43200',
    },
  });
};
