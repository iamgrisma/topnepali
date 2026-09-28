import type { APIRoute } from 'astro';
import { getPosts } from '../../lib/wp';

export const GET: APIRoute = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const perPage = parseInt(url.searchParams.get('per_page') || '10', 10);
  const category = url.searchParams.get('category') || undefined;
  const tag = url.searchParams.get('tag') || undefined;
  const search = url.searchParams.get('search') || url.searchParams.get('q') || undefined;

  try {
    const result = await getPosts({
      page,
      perPage,
      category,
      tag,
      search,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Failed to fetch posts' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
