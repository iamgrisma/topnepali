import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, '.mcp-token.json');
const WP_BASE = 'https://wp.topnepali.com';
const MCP_ENDPOINT = `${WP_BASE}/wp-json/easy-mcp-ai/v1/mcp`;
const TOKEN_ENDPOINT = `${WP_BASE}/wp-json/easy-mcp-ai/v1/oauth/token`;
const CLIENT_ID = '39fdec36b39a6414054b8f3e3d081766';

// Initial tokens if token file doesn't exist
let tokenData = {
  access_token: 'wpmcp_oat_fea9288ccd071478bf784d6aa0a749621e8192ee90acc15dead61d198bd13e55',
  refresh_token: '315fa2a6286cfee0c56accc2756d232249860bfc5995645d74619788a02e5655',
  expires_at: Date.now() + 3500 * 1000
};

if (fs.existsSync(TOKEN_FILE)) {
  try {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
    tokenData = JSON.parse(raw);
  } catch (e) {
    console.error('[mcp-bridge] Failed to read token file:', e.message);
  }
} else {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), 'utf-8');
  } catch (e) {
    console.error('[mcp-bridge] Failed to save initial token file:', e.message);
  }
}

function saveToken(data) {
  tokenData.access_token = data.access_token;
  if (data.refresh_token) tokenData.refresh_token = data.refresh_token;
  tokenData.expires_at = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), 'utf-8');
  } catch (e) {
    console.error('[mcp-bridge] Failed to write token file:', e.message);
  }
}

async function refreshToken() {
  console.error('[mcp-bridge] Refreshing OAuth token...');
  try {
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
      saveToken(data);
      console.error('[mcp-bridge] Token refreshed successfully.');
      return true;
    } else {
      console.error('[mcp-bridge] Token refresh failed:', JSON.stringify(data));
      return false;
    }
  } catch (e) {
    console.error('[mcp-bridge] Error during token refresh:', e.message);
    return false;
  }
}

async function sendMcpRequest(payload) {
  function loadTokenFromDisk() {
    if (fs.existsSync(TOKEN_FILE)) {
      try {
        const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
        tokenData = JSON.parse(raw);
      } catch (e) {
        console.error('[mcp-bridge] Failed to read token file:', e.message);
      }
    }
  }

  loadTokenFromDisk();

  if (Date.now() >= (tokenData.expires_at || 0)) {
    await refreshToken();
  }

  let res = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenData.access_token}`
    },
    body: JSON.stringify(payload)
  });

  if (res.status === 401) {
    console.error('[mcp-bridge] Received 401 Unauthorized. Retrying after token refresh...');
    const refreshed = await refreshToken();
    if (refreshed) {
      res = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        },
        body: JSON.stringify(payload)
      });
    }
  }

  const text = await res.text();
  if (!text.trim()) {
    return {
      jsonrpc: '2.0',
      id: payload.id ?? null,
      error: {
        code: res.status !== 200 ? -32000 : -32603,
        message: `WordPress MCP returned HTTP ${res.status} with empty body`
      }
    };
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      jsonrpc: '2.0',
      id: payload.id || null,
      error: { code: -32603, message: 'Invalid JSON response from WordPress MCP', data: text }
    };
  }
}

// Stdio JSON-RPC line reader
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const payload = JSON.parse(trimmed);
    const response = await sendMcpRequest(payload);
    if (response) {
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (err) {
    console.error('[mcp-bridge] Error handling line:', err);
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error', data: String(err) }
    }) + '\n');
  }
});

console.error('[mcp-bridge] TopNepali MCP stdio bridge active.');
