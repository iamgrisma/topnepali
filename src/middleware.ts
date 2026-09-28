import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  const pathname = url.pathname;
  const method = context.request.method;

  // 1. Skip caching for webhooks and search queries
  const isWebhookOrApi = pathname.startsWith('/api/');
  const isSearch = pathname === '/search' || url.searchParams.has('q') || url.searchParams.has('s');
  const isCacheable = (method === 'GET' || method === 'HEAD') && !isWebhookOrApi && !isSearch;

  // 2. Native Cloudflare Worker Cache API Lookup (Sub-15ms Edge Cache Hit)
  const globalCaches = typeof caches !== 'undefined' ? (caches as any) : null;
  if (isCacheable && globalCaches?.default) {
    try {
      const cached = await globalCaches.default.match(context.request);
      if (cached) {
        const hitResponse = new Response(cached.body, cached);
        hitResponse.headers.set('X-Edge-Cache', 'HIT');
        return hitResponse;
      }
    } catch (err) {
      console.warn('[middleware] cache match error:', err);
    }
  }

  // Let the page render via SSR
  const response = await next();

  try {
    // 3. Never cache webhook endpoint
    if (pathname.startsWith('/api/revalidate')) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return response;
    }

    // 4. Headless JSON API: short cache with SWR
    if (pathname.startsWith('/api/')) {
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=300, stale-while-revalidate=600');
      return response;
    }

    // 5. Static assets & media: long-term immutable edge cache (1 year)
    if (
      pathname.startsWith('/_astro/') ||
      /\.(svg|ico|png|jpg|jpeg|webp|woff2?|ttf|eot|css|js)$/i.test(pathname)
    ) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=31536000, immutable');
      return response;
    }

    // 6. Dynamic SSR HTML pages:
    // With on-demand revalidation (/api/revalidate), pages stay cached for 1 year (31,536,000s) on Cloudflare CDN.
    // They are only purged when WordPress sends an update webhook.
    if (response.status === 200) {
      response.headers.set('Vary', 'Accept-Encoding');
      if (isSearch) {
        // Search queries: 10 minutes cache
        response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=1200');
        response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=600, stale-while-revalidate=1200');
      } else {
        // 1-year CDN edge cache (s-maxage=31536000)
        // 1-hour browser cache (max-age=3600) with 1-day stale-while-revalidate
        response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400');
        response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=31536000, stale-while-revalidate=86400');
        response.headers.set('X-Edge-Cache', 'MISS');

        // Store into Cloudflare Worker Cache API for subsequent hits
        if (globalCaches?.default) {
          try {
            const clone = response.clone();
            const cfCtx = (context.locals as any)?.cfContext;
            let responseToStore = clone;
            if (clone.headers.has('Set-Cookie')) {
              const cleanHeaders = new Headers(clone.headers);
              cleanHeaders.delete('Set-Cookie');
              responseToStore = new Response(clone.body, {
                status: clone.status,
                statusText: clone.statusText,
                headers: cleanHeaders,
              });
            }
            if (cfCtx && typeof cfCtx.waitUntil === 'function') {
              cfCtx.waitUntil(globalCaches.default.put(context.request, responseToStore));
            } else {
              globalCaches.default.put(context.request, responseToStore).catch(() => {});
            }
          } catch (err) {
            console.warn('[middleware] cache put error:', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[middleware] cache header error:', err);
  }

  return response;
});
