import type { APIRoute } from 'astro';
import { clearWpCache } from '../../lib/wp';
import { SITE_URL, REVALIDATE_SECRET } from '../../config';

export const POST: APIRoute = async ({ request, url }) => {
  try {
    // 1. Authenticate webhook request
    const authHeader = request.headers.get('x-revalidate-secret') || request.headers.get('authorization');
    const secretFromQuery = url.searchParams.get('secret');
    const providedSecret = authHeader?.replace(/^Bearer\s+/i, '') || secretFromQuery;

    if (!providedSecret || providedSecret !== REVALIDATE_SECRET) {
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
    const siteUrl = SITE_URL;
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

    // 5. Native Cloudflare Worker Cache API Purge (Zero credentials / zero zone ID required)
    let nativePurgedCount = 0;
    try {
      const globalCaches = (globalThis as any).caches;
      if (globalCaches && typeof globalCaches.default !== 'undefined') {
        const cfCache = globalCaches.default;
        for (const pUrl of purgeUrls) {
          try {
            const deleted = await cfCache.delete(pUrl);
            const deletedReq = await cfCache.delete(new Request(pUrl));
            if (deleted || deletedReq) nativePurgedCount++;
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[revalidate] native caches.default purge warning:', err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        slug: slug || null,
        type,
        internalCacheEntriesCleared: clearedCacheCount,
        purgedUrls: purgeUrls,
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
