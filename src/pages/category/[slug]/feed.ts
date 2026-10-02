import type { APIRoute } from 'astro';
import { generateRssFeed } from '../../../lib/rss';

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response('Category slug missing', { status: 400 });
  }
  return generateRssFeed({
    categorySlug: slug,
    feedPath: `category/${slug}/feed`,
  });
};
