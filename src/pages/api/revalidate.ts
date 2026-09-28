import type { APIRoute } from 'astro';
import { clearWpCache } from '../../lib/wp';

export const POST: APIRoute = async ({ request, url }) => {
  try {
    // 1. Authenticate webhook request
    const authHeader = request.headers.get('x-revalidate-secret') || request.headers.get('authorization');
    const secretFromQuery = url.searchParams.get('secret');
    const configuredSecret =
      process.env.REVALIDATE_SECRET ||
      process.env.INTERNAL_API_SECRET ||
      'topnepali_revalidate_secure_token';

    const providedSecret = authHeader?.replace(/^Bearer\s+/i, '') || secretFromQuery;

    if (!providedSecret || providedSecret !== configuredSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid revalidate secret token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse request payload
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {
        slug: url.searchParams.get('slug'),
        type: url.searchParams.get('type') || 'post',
      };
    }

    const { slug, type = 'post', urls: customUrls = [] } = body;

    // 3. Invalidate internal SSR node/worker memory cache
    const clearedCacheCount = clearWpCache(slug || undefined);

    // 4. Determine URLs to purge from Cloudflare Global Edge CDN
    const siteUrl = (process.env.SITE_URL || 'https://topnepali.com').replace(/\/+$/, '');
    const purgeUrls: string[] = [];

    // Always purge the homepage because latest post feeds change on update
    purgeUrls.push(`${siteUrl}/`);
    purgeUrls.push(`${siteUrl}/api/posts`);

    if (slug) {
      const cleanSlug = String(slug).replace(/^\/+|\/+$/g, '');
      purgeUrls.push(`${siteUrl}/${cleanSlug}`);
      purgeUrls.push(`${siteUrl}/${cleanSlug}/`);
    }

    if (Array.isArray(customUrls)) {
      for (const u of customUrls) {
        const fullUrl = u.startsWith('http') ? u : `${siteUrl}/${u.replace(/^\/+/, '')}`;
        if (!purgeUrls.includes(fullUrl)) {
          purgeUrls.push(fullUrl);
        }
      }
    }

    // 5. Call Cloudflare Purge Cache API if credentials are provided
    let cfPurgeResult = null;
    const cfZoneId = process.env.CLOUDFLARE_ZONE_ID;
    const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (cfZoneId && cfApiToken) {
      try {
        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}/purge_cache`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: purgeUrls,
          }),
        });

        cfPurgeResult = await cfRes.json();
      } catch (err: any) {
        console.error('[revalidate] Cloudflare purge API error:', err);
        cfPurgeResult = { error: err?.message || String(err) };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        slug: slug || null,
        type,
        internalCacheEntriesCleared: clearedCacheCount,
        purgedUrls: purgeUrls,
        cloudflarePurge: cfPurgeResult ? (cfPurgeResult.success ? 'purged' : cfPurgeResult) : 'skipped (no CF token configured in env)',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Revalidation failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// Also support GET for simple browser / webhook testing
export const GET: APIRoute = async (context) => {
  return POST(context);
};
