import type { APIRoute } from 'astro';
import { generateRssFeed } from '../lib/rss';

export const GET: APIRoute = async () => {
  return generateRssFeed('feed');
};
