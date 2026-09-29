import type { APIRoute } from 'astro';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PLUGIN_VERSION = '1.1.0';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/iamgrisma/topnepali/main/wp-plugin/headless/headless.php';

export const GET: APIRoute = async ({ url }) => {
  const isInfo = url.searchParams.has('info');
  const isDownload = url.searchParams.has('download');

  if (isInfo) {
    return new Response(
      JSON.stringify({
        name: 'TopNepali Headless',
        slug: 'headless',
        version: PLUGIN_VERSION,
        author: 'Top Nepali',
        homepage: 'https://topnepali.com',
        download_url: GITHUB_RAW_URL,
        requires: '5.6',
        tested: '6.7',
        last_updated: new Date().toISOString(),
        sections: {
          description: 'High-performance Headless WordPress engine for Astro & Cloudflare Edge.',
          changelog: 'v1.1.0: Added 1-click in-place self-updater, REST API edge cache headers, and multi-origin edge warming.',
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, s-maxage=600',
        },
      }
    );
  }

  // If download or direct view requested, serve the raw plugin file
  try {
    const pluginPath = resolve(process.cwd(), 'wp-plugin/headless/headless.php');
    if (existsSync(pluginPath)) {
      const content = readFileSync(pluginPath, 'utf8');
      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=600',
        },
      });
    }
  } catch {}

  // Fallback: redirect or fetch from GitHub raw
  const ghRes = await fetch(GITHUB_RAW_URL);
  const text = await ghRes.text();
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
};
