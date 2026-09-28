import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  const pathname = url.pathname;

  // Let the page render
  const response = await next();

  try {
    // 1. Never cache internal/webhook API endpoints
    if (pathname.startsWith('/api/revalidate')) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return response;
    }

    // 2. Headless JSON API: short cache with SWR
    if (pathname.startsWith('/api/')) {
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=300, stale-while-revalidate=600');
      return response;
    }

    // 3. Static assets & media: long-term immutable edge cache (1 year)
    if (
      pathname.startsWith('/_astro/') ||
      /\.(svg|ico|png|jpg|jpeg|webp|woff2?|ttf|eot|css|js)$/i.test(pathname)
    ) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=31536000, immutable');
      return response;
    }

    // 4. Dynamic SSR HTML pages:
    // Shield Cloudflare Workers from quota exhaustion by setting Cloudflare CDN edge cache (7 days) with 1-day SWR.
    // Cloudflare Edge serves cached responses directly without invoking the Worker script!
    if (response.status === 200) {
      response.headers.set('Vary', 'Accept-Encoding');
      if (pathname === '/search' || url.searchParams.has('q') || url.searchParams.has('s')) {
        // Search queries: 10 minutes cache
        response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=1200');
        response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=600, stale-while-revalidate=1200');
      } else {
        // Blog posts, homepage, categories, pages:
        // 7 days edge cache. When an update occurs, WordPress triggers /api/revalidate to purge.
        response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=604800, stale-while-revalidate=86400');
        response.headers.set('Cloudflare-CDN-Cache-Control', 'max-age=604800, stale-while-revalidate=86400');
      }
    }
  } catch (err) {
    console.error('[middleware] cache header error:', err);
  }

  return response;
});
