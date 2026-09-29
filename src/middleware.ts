import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  const pathname = url.pathname;
  const method = context.request.method;

  // Let the page render via SSR
  const response = await next();

  try {
    // 1. Crawler shield for 404 responses
    if (response.status === 404) {
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=600');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=600');
      return response;
    }

    // 2. Non-200 errors are never cached
    if (response.status >= 400) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return response;
    }

    // 3. Webhook endpoints (never cache)
    if (pathname.startsWith('/api/revalidate')) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return response;
    }

    // 4. Non-GET requests are never cached
    if (method !== 'GET' && method !== 'HEAD') {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return response;
    }

    // 5. Headless JSON APIs: short edge cache to absorb bursts
    if (pathname.startsWith('/api/')) {
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=300, stale-while-revalidate=600');
      return response;
    }

    // 6. Static assets & media: long-term immutable cache (content-hashed)
    if (
      pathname.startsWith('/_astro/') ||
      /\.(svg|ico|png|jpg|jpeg|webp|woff2?|ttf|eot|css|js)$/i.test(pathname)
    ) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=31536000, immutable');
      return response;
    }

    // 7. Dynamic SSR HTML pages:
    // Browser must revalidate (max-age=0, must-revalidate) so new deployments appear immediately.
    // Cloudflare Edge CDN caches for 10 minutes with stale-while-revalidate for sub-15ms TTFB.
    response.headers.set('Vary', 'Accept-Encoding');
    if (pathname === '/search' || url.searchParams.has('q') || url.searchParams.has('s')) {
      response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=300, stale-while-revalidate=600');
    } else {
      response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=3600, stale-while-revalidate=86400');
    }

    // Standard security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  } catch (err) {
    console.error('[middleware] cache header error:', err);
  }

  return response;
});
