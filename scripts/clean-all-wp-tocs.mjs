import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, '.mcp-token.json');
const WP_BASE = 'https://wp.topnepali.com';
const MCP_ENDPOINT = `${WP_BASE}/wp-json/easy-mcp-ai/v1/mcp`;
const TOKEN_ENDPOINT = `${WP_BASE}/wp-json/easy-mcp-ai/v1/oauth/token`;
const CLIENT_ID = '39fdec36b39a6414054b8f3e3d081766';

let tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));

async function refreshToken() {
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
    return true;
  }
  throw new Error('Failed to refresh token: ' + JSON.stringify(data));
}

async function callMcpTool(name, args, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (Date.now() >= (tokenData.expires_at || 0)) await refreshToken();
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
        params: { name, arguments: args }
      })
    });

    if (res.status === 401) {
      await refreshToken();
      continue;
    }

    const json = await res.json();
    if (json.error && json.error.code === -32003) {
      // Rate limit hit: backoff 15 seconds
      console.log(`[Rate Limit] Backing off 15s before retrying ${name}...`);
      await new Promise(r => setTimeout(r, 15000));
      continue;
    }
    return json;
  }
  throw new Error(`Failed to call ${name} after ${retries} attempts.`);
}

const POST_IDS = [
  9870, 9751, 5132, 3561, 10016, 9771, 9765, 9676, 5140, 9493,
  9400, 4185, 9118, 4628, 7220, 7238, 7216, 5091, 8890, 8852,
  8693, 6241, 7856, 7351, 7341, 5116, 5119, 6828, 3782, 5960,
  5860, 5854, 5174, 5135, 4885, 4393, 3929, 3922, 3679
];

async function main() {
  console.log(`Starting TOC cleanup on ${POST_IDS.length} posts...`);
  let cleanedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < POST_IDS.length; i++) {
    const postId = POST_IDS[i];
    try {
      const getRes = await callMcpTool('wp_get_post', { post_id: postId });
      if (!getRes.result?.content?.[0]?.text) {
        console.warn(`[${i + 1}/${POST_IDS.length}] Post ${postId}: No content returned.`);
        continue;
      }
      const post = JSON.parse(getRes.result.content[0].text);
      const originalContent = post.content || '';

      const hasBlock = /<!--\s*wp:(?:rank-math\/toc-block|uagb\/table-of-contents)[\s\S]*?<!--\s*\/wp:(?:rank-math\/toc-block|uagb\/table-of-contents)\s*-->/i.test(originalContent) ||
                       /<div[^>]*class="[^"]*(?:wp-block-rank-math-toc-block|wp-block-uagb-table-of-contents)[^"]*"[\s\S]*?<\/div>\s*<\/div>/i.test(originalContent);

      if (!hasBlock) {
        console.log(`[${i + 1}/${POST_IDS.length}] Post ${postId} (${post.slug}): No block TOC found. Skipped.`);
        skippedCount++;
      } else {
        const cleanContent = originalContent
          .replace(/<!--\s*wp:rank-math\/toc-block[\s\S]*?<!--\s*\/wp:rank-math\/toc-block\s*-->\s*/gi, '')
          .replace(/<!--\s*wp:uagb\/table-of-contents[\s\S]*?<!--\s*\/wp:uagb\/table-of-contents\s*-->\s*/gi, '')
          .replace(/<div\b[^>]*class="[^"]*wp-block-rank-math-toc-block[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*/gi, '')
          .replace(/<div\b[^>]*class="[^"]*wp-block-uagb-table-of-contents[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*/gi, '');

        const updateRes = await callMcpTool('wp_update_post', {
          post_id: postId,
          content: cleanContent
        });

        if (updateRes.result) {
          console.log(`[${i + 1}/${POST_IDS.length}] Post ${postId} (${post.slug}): Cleaned and updated! (${originalContent.length} -> ${cleanContent.length} chars)`);
          cleanedCount++;
        } else {
          console.warn(`[${i + 1}/${POST_IDS.length}] Post ${postId} (${post.slug}): Update returned unexpected response:`, JSON.stringify(updateRes));
        }
      }
    } catch (err) {
      console.error(`[${i + 1}/${POST_IDS.length}] Post ${postId} error:`, err.message);
    }

    // Polite delay between posts to prevent burst rate-limiting
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`\nCleanup finished: ${cleanedCount} posts cleaned, ${skippedCount} skipped.`);
}

main().catch(console.error);
