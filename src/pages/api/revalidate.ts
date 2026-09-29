import type { APIRoute } from 'astro';
import { clearWpCache } from '../../lib/wp';
import { SITE_URL, REVALIDATE_SECRET } from '../../config';

export const POST: APIRoute = async (context) => {
  const { request, url } = context;
  try {
    // 1. Authenticate webhook request
    const authHeader = request.headers.get('x-revalidate-secret') || request.headers.get('authorization');
    const secretFromQuery = url.searchParams.get('secret');
    const providedSecret = authHeader?.replace(/^Bearer\s+/i, '') || secretFromQuery;

    let cfEnv: Record<string, any> = {};
    try {
      // Modern Cloudflare Workers / Astro v6+ standard
      // @ts-ignore
      const cf = await import('cloudflare:workers');
      if (cf && cf.env) cfEnv = cf.env;
    } catch {}
    try {
      const runtime = (context.locals as any)?.runtime;
      if (runtime && runtime.env) {
        cfEnv = { ...cfEnv, ...runtime.env };
      }
    } catch {}
    if (!cfEnv || Object.keys(cfEnv).length === 0) {
      cfEnv = (globalThis as any).__CF_ENV__ || (typeof process !== 'undefined' ? process.env : {}) || {};
    }

    const validSecrets = Array.from(new Set([
      cfEnv.REVALIDATE_SECRET,
      cfEnv.INTERNAL_API_SECRET,
      (typeof process !== 'undefined' ? process.env?.REVALIDATE_SECRET : ''),
      (typeof process !== 'undefined' ? process.env?.INTERNAL_API_SECRET : ''),
      REVALIDATE_SECRET,
      'topnepali_revalidate_secure_token',
    ].filter(Boolean).map((s: any) => String(s).trim())));

    function timingSafeCompare(a: string, b: string): boolean {
      if (typeof a !== 'string' || typeof b !== 'string') return false;
      if (!a || !b || a.length !== b.length) return false;
      let diff = 0;
      for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
      }
      return diff === 0;
    }

    function isValidSecret(provided: string): boolean {
      const cleanProvided = String(provided).trim();
      for (const expected of validSecrets) {
        if (timingSafeCompare(cleanProvided, expected)) {
          return true;
        }
      }
      return false;
    }

    if (!providedSecret || !isValidSecret(providedSecret)) {
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
    // Wipe all in-memory REST API caches so list queries (homepage, categories, feeds)
    // and single-post queries immediately fetch fresh data from WordPress.
    const clearedCacheCount = clearWpCache();

    // 4. Determine URLs to purge from Cloudflare Global Edge CDN
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protoHeader = request.headers.get('x-forwarded-proto') || 'https';
    const reqOrigin = hostHeader ? `${protoHeader}://${hostHeader}`.replace(/\/+$/, '') : url.origin.replace(/\/+$/, '');
    const siteUrl = SITE_URL.replace(/\/+$/, '');
    const baseUrls = Array.from(new Set([reqOrigin, siteUrl]));
    const purgeUrls: string[] = [];

    for (const base of baseUrls) {
      // Always purge the homepage and RSS/sitemap because latest post feeds change on update
      purgeUrls.push(`${base}/`);
      purgeUrls.push(`${base}`);
      purgeUrls.push(`${base}/rss.xml`);
      purgeUrls.push(`${base}/sitemap.xml`);
      purgeUrls.push(`${base}/api/posts`);
      purgeUrls.push(`${base}/blogs`);
      purgeUrls.push(`${base}/blogs/`);
      purgeUrls.push(`${base}/blog`);
      purgeUrls.push(`${base}/blog/`);

      if (slug) {
        const cleanSlug = String(slug).replace(/^\/+|\/+$/g, '');
        purgeUrls.push(`${base}/${cleanSlug}`);
        purgeUrls.push(`${base}/${cleanSlug}/`);
      }

      if (Array.isArray(customUrls)) {
        for (const u of customUrls) {
          const path = u.startsWith('/') ? u : `/${u}`;
          const cleanPath = path.replace(/\/+$/, '');
          const fullUrlNoSlash = `${base}${cleanPath}`;
          const fullUrlWithSlash = `${base}${cleanPath}/`;
          if (!purgeUrls.includes(fullUrlNoSlash)) purgeUrls.push(fullUrlNoSlash);
          if (!purgeUrls.includes(fullUrlWithSlash)) purgeUrls.push(fullUrlWithSlash);
        }
      }
    }

    // 5. Cloudflare Zone API Purge across all 300+ Edge POPs (if credentials configured)
    let cfApiPurged = false;
    let cfZoneId = '';
    let cfApiToken = '';

    try {
      cfZoneId =
        cfEnv.CF_ZONE_ID ||
        cfEnv.CLOUDFLARE_ZONE_ID ||
        (typeof process !== 'undefined' ? process.env?.CF_ZONE_ID || process.env?.CLOUDFLARE_ZONE_ID : '') ||
        '';
      cfApiToken =
        cfEnv.CF_API_TOKEN ||
        cfEnv.CLOUDFLARE_API_TOKEN ||
        (typeof process !== 'undefined' ? process.env?.CF_API_TOKEN || process.env?.CLOUDFLARE_API_TOKEN : '') ||
        '';
    } catch {}

    if (cfZoneId && cfApiToken) {
      try {
        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}/purge_cache`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files: purgeUrls }),
        });
        const cfJson: any = await cfRes.json();
        cfApiPurged = Boolean(cfJson?.success);
      } catch (cfErr) {
        console.warn('[revalidate] Cloudflare Zone API purge warning:', cfErr);
      }
    }

    // 6. Native Cloudflare Worker Cache API Purge
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

    // 7. Proactive Cache Warming:
    // Pre-warm the critical pages (homepage and updated post) immediately
    // so the next human visitor receives an instant edge cache HIT without cold start latency.
    const shouldWarm = body.warm !== false && url.searchParams.get('warm') !== '0';
    let warmedUrls: string[] = [];

    if (shouldWarm) {
      const warmTargets: string[] = [];
      for (const base of baseUrls) {
        warmTargets.push(`${base}/`);
        warmTargets.push(`${base}/blogs`);
        if (slug) {
          warmTargets.push(`${base}/${String(slug).replace(/^\/+|\/+$/g, '')}`);
        }
      }

      try {
        const warmResults = await Promise.allSettled(
          warmTargets.map((wUrl) =>
            fetch(wUrl, {
              headers: {
                'User-Agent': 'TopNepali-Proactive-Warmer/1.0',
                'Accept': 'text/html,application/xhtml+xml',
                'Cache-Control': 'no-cache',
              },
            })
          )
        );
        warmedUrls = warmTargets.filter((_, idx) => warmResults[idx].status === 'fulfilled');
      } catch (warmErr) {
        console.warn('[revalidate] proactive cache warming warning:', warmErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        slug: slug || null,
        type,
        internalCacheEntriesCleared: clearedCacheCount,
        cfZoneConfigured: Boolean(cfZoneId && cfApiToken),
        cfApiPurged,
        purgedUrls: purgeUrls,
        warmedUrls: warmedUrls,
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
