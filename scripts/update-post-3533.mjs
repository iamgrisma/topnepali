import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, '.mcp-token.json');
const CONTENT_FILE = path.join(__dirname, 'new-post-3533-content.html');
const WP_BASE = 'https://wp.topnepali.com';
const MCP_ENDPOINT = `${WP_BASE}/wp-json/easy-mcp-ai/v1/mcp`;
const TOKEN_ENDPOINT = `${WP_BASE}/wp-json/easy-mcp-ai/v1/oauth/token`;
const CLIENT_ID = '39fdec36b39a6414054b8f3e3d081766';

let tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));

async function refreshToken() {
  console.log('Refreshing OAuth token...');
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: tokenData.refresh_token
    })
  });
  const data = await res.json();
  if (data.access_token) {
    tokenData.access_token = data.access_token;
    if (data.refresh_token) tokenData.refresh_token = data.refresh_token;
    tokenData.expires_at = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), 'utf-8');
    console.log('Token refreshed successfully.');
    return true;
  }
  throw new Error('Failed to refresh token: ' + JSON.stringify(data));
}

async function callMcpTool(name, args) {
  if (Date.now() >= (tokenData.expires_at || 0)) {
    await refreshToken();
  }
  let res = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenData.access_token}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    })
  });

  if (res.status === 401) {
    console.log('401 received, retrying after refresh...');
    await refreshToken();
    res = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name,
          arguments: args
        }
      })
    });
  }

  const json = await res.json();
  return json;
}

async function main() {
  const content = fs.readFileSync(CONTENT_FILE, 'utf-8');
  console.log(`Loaded updated content (${content.length} characters)`);

  const updateArgs = {
    post_id: 3533,
    title: 'Postal Code of Nepal (2026 Directory) — All 77 Districts & Instant Lookup',
    excerpt: 'Official 5-digit postal codes and ZIP codes for all 77 districts in Nepal (2026). Quick lookup for Kathmandu (44600), Pokhara (33700), Lalitpur, and 1,000+ local post offices.',
    content: content,
    date: new Date().toISOString()
  };

  console.log('Calling wp_update_post for Post ID 3533...');
  const result = await callMcpTool('wp_update_post', updateArgs);
  console.log('wp_update_post response:');
  console.log(JSON.stringify(result, null, 2));

  // Purge Astro Edge Cache
  console.log('\nPurging Cloudflare edge cache via /api/revalidate...');
  const revalRes = await fetch('https://topnepali.com/api/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: 'topnepali_revalidate_secure_token',
      slug: 'postal-code-zip-code-for-nepal'
    })
  });
  const revalData = await revalRes.json();
  console.log('Revalidation response:', JSON.stringify(revalData, null, 2));
}

main().catch(err => {
  console.error('Update script failed:', err);
  process.exit(1);
});
