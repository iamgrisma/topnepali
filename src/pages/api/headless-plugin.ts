import type { APIRoute } from 'astro';
import pluginRawCode from '../../../wp-plugin/headless/headless.php?raw';
import { REVALIDATE_SECRET } from '../../config';

// Extract version dynamically from plugin code header
const versionMatch = pluginRawCode.match(/Version:\s*([0-9\.]+)/i);
const PLUGIN_VERSION = versionMatch ? versionMatch[1] : '1.2.2';

export const GET: APIRoute = async ({ url, request }) => {
  const reqSecret = url.searchParams.get('secret') || request.headers.get('x-revalidate-secret');

  // Strictly enforce secret token authentication to protect private plugin distribution
  if (!reqSecret || reqSecret !== REVALIDATE_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Valid secret token required' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const isInfo = url.searchParams.has('info');
  const isDownload = url.searchParams.has('download');

  const origin = url.origin;
  const downloadUrl = `${origin}/api/headless-plugin?download=1${reqSecret ? `&secret=${encodeURIComponent(reqSecret)}` : ''}`;

  if (isInfo) {
    return new Response(
      JSON.stringify({
        name: 'TopNepali Headless Engine',
        slug: 'topnepali-headless',
        version: PLUGIN_VERSION,
        author: 'Top Nepali',
        homepage: origin,
        download_url: downloadUrl,
        requires: '5.6',
        tested: '6.7',
        last_updated: new Date().toISOString(),
        sections: {
          description: 'High-performance Headless WordPress engine for Astro & Cloudflare Edge.',
          changelog: `v${PLUGIN_VERSION}: Cloudflare Edge-served distribution with WordPress.org collision blocking and 1-click in-place updater.`,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  // Return the raw PHP file content for direct download or in-place self-updater
  return new Response(pluginRawCode, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="headless.php"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Plugin-Version': PLUGIN_VERSION,
    },
  });
};

