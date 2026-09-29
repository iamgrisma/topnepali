import type { APIRoute } from 'astro';
import { WP_URL, SITE_URL } from '../config';

export const GET: APIRoute = async () => {
  const wpBase = WP_URL.replace(/\/+$/, '');
  const siteUrl = SITE_URL.replace(/\/+$/, '');
  const siteHost = new URL(siteUrl).host;

  try {
    const res = await fetch(`${wpBase}/main-sitemap.xsl`, {
      headers: {
        'Accept': 'text/xml,application/xml,*/*',
        'User-Agent': 'TopNepali-Sitemap-Proxy/1.0',
      },
    });

    if (res.ok) {
      let xsl = await res.text();
      xsl = xsl
        .replace(/https?:\/\/wp\.topnepali\.com/gi, siteUrl)
        .replace(/\/\/wp\.topnepali\.com/gi, `//${siteHost}`);

      return new Response(xsl, {
        status: 200,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
          'Cloudflare-CDN-Cache-Control': 'max-age=604800, stale-while-revalidate=86400',
        },
      });
    }
  } catch (err) {
    console.error('[main-sitemap.xsl] Error proxying XSL stylesheet:', err);
  }

  return new Response('/* Rank Math XSL Stylesheet unavailable */', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  });
};
