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

    // 2.1 Empty or zero-length responses are never cached
    const cl = response.headers.get('content-length');
    if (cl === '0') {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return response;
    }

    // 3. Webhook & private plugin distribution endpoints (never cache)
    if (pathname.startsWith('/api/revalidate') || pathname.startsWith('/api/headless-plugin')) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return response;
    }

    // 4. Non-GET requests are never cached
    if (method !== 'GET' && method !== 'HEAD') {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return response;
    }

    // 5. Public Headless JSON APIs: short edge cache to absorb bursts
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
    // - Visitor browser: max-age=0, must-revalidate (always contacts edge; instant update upon webhook purge)
    // - Cloudflare Global Edge CDN:
    //   - Search: max-age=300, stale-while-revalidate=600 (absorbs search traffic spikes)
    //   - Homepage, Archives & Feeds: max-age=604800, stale-while-revalidate=86400 (7 days edge cache, purged on-demand via /api/revalidate)
    //   - Single Posts & Pages: max-age=604800, stale-while-revalidate=86400 (sub-15ms edge hits worldwide)
    response.headers.set('Vary', 'Accept-Encoding');
    if (pathname === '/search' || url.searchParams.has('q') || url.searchParams.has('s')) {
      response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=600');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=300, stale-while-revalidate=600');
    } else if (
      pathname === '/' ||
      pathname === '/blogs' ||
      pathname === '/blogs/' ||
      pathname === '/blog' ||
      pathname === '/blog/' ||
      pathname === '/rss.xml' ||
      pathname.startsWith('/category/') ||
      pathname.startsWith('/tag/')
    ) {
      response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate, s-maxage=31536000, stale-while-revalidate=86400');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=31536000, stale-while-revalidate=86400');
    } else {
      // Single post or single page — cached at edge for 1 year, purged on-demand via WordPress webhook
      response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate, s-maxage=31536000, stale-while-revalidate=86400');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=31536000, stale-while-revalidate=86400');
    }

    // Standard modern security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  } catch (err) {
    console.error('[middleware] cache header error:', err);
  }

  return response;
});
