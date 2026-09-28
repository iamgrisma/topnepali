import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const clientDir = path.join(distDir, 'client');
const serverDir = path.join(distDir, 'server');
const dotWranglerDir = path.join(rootDir, '.wrangler');
const serverWranglerJson = path.join(serverDir, 'wrangler.json');

if (process.env.DEPLOY_TARGET === 'node') {
  console.log('[prepare-pages] DEPLOY_TARGET is node, skipping Cloudflare Pages bundle preparation.');
  process.exit(0);
}

console.log('[prepare-pages] Adapting Astro build for Cloudflare Pages Advanced Mode...');

// 1. Copy client assets to root of dist/
if (fs.existsSync(clientDir)) {
  const items = fs.readdirSync(clientDir);
  for (const item of items) {
    const src = path.join(clientDir, item);
    const dest = path.join(distDir, item);
    fs.cpSync(src, dest, { recursive: true, force: true });
  }
  console.log(`[prepare-pages] Copied static client assets to dist/ root (${items.length} items)`);
}

// 1.1 Ensure root-level favicon, robots.txt are present at dist/ root
['robots.txt', 'favicon.ico'].forEach((asset) => {
  const pubPath = path.join(rootDir, 'public', asset);
  if (fs.existsSync(pubPath)) {
    fs.copyFileSync(pubPath, path.join(distDir, asset));
    console.log(`[prepare-pages] Copied ${asset} to dist/ root`);
  }
});

// Remove _redirects completely (Zero Redirection policy)
[path.join(clientDir, '_redirects'), path.join(distDir, '_redirects')].forEach((f) => {
  if (fs.existsSync(f)) {
    fs.rmSync(f, { force: true });
    console.log(`[prepare-pages] Removed ${path.basename(f)} (zero redirects policy)`);
  }
});

// 2. Create _worker.js pointing to server/entry.mjs
const workerFile = path.join(distDir, '_worker.js');
const workerContent = `import serverEntry from './server/entry.mjs';

export default {
  fetch(req, env, ctx) {
    globalThis.__CF_ENV__ = env;
    return serverEntry.fetch(req, env, ctx);
  }
};
`;
fs.writeFileSync(workerFile, workerContent);
console.log('[prepare-pages] Created dist/_worker.js with fetch handler');

// 3. Ensure _routes.json excludes /_astro/* for optimal static asset serving
const routesJsonFile = path.join(distDir, '_routes.json');
if (fs.existsSync(routesJsonFile)) {
  try {
    const routes = JSON.parse(fs.readFileSync(routesJsonFile, 'utf8'));
    if (Array.isArray(routes.exclude) && !routes.exclude.includes('/_astro/*')) {
      routes.exclude.unshift('/_astro/*');
      fs.writeFileSync(routesJsonFile, JSON.stringify(routes, null, 2));
      console.log('[prepare-pages] Added /_astro/* to _routes.json exclude rules');
    }
  } catch (err) {
    console.warn('[prepare-pages] Failed to update _routes.json:', err.message);
  }
}

// 4. Update .assetsignore so Cloudflare Pages doesn't serve _worker.js and server files as raw downloads
const assetsIgnoreFile = path.join(distDir, '.assetsignore');
let assetsIgnore = '';
if (fs.existsSync(assetsIgnoreFile)) {
  assetsIgnore = fs.readFileSync(assetsIgnoreFile, 'utf8');
}
if (!assetsIgnore.includes('_worker.js')) assetsIgnore += '\n_worker.js';
if (!assetsIgnore.includes('server/**')) assetsIgnore += '\nserver/**';
fs.writeFileSync(assetsIgnoreFile, assetsIgnore.trim() + '\n');
console.log('[prepare-pages] Updated dist/.assetsignore');

// 5. Clean up .wrangler and dist/server/wrangler.json to prevent validation errors
if (fs.existsSync(dotWranglerDir)) {
  fs.rmSync(dotWranglerDir, { recursive: true, force: true });
}
if (fs.existsSync(serverWranglerJson)) {
  fs.rmSync(serverWranglerJson, { force: true });
}

// 6. Ensure wrangler.toml exists
const wranglerTomlFile = path.join(rootDir, 'wrangler.toml');
if (!fs.existsSync(wranglerTomlFile)) {
  const tomlContent = `name = "topnepali"
main = "@astrojs/cloudflare/entrypoints/server"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist/client"
binding = "ASSETS"

[vars]
URL = "https://topnepali.com"
WORDPRESS_URL = "https://wp.topnepali.com"
REVALIDATE_SECRET = "topnepali_revalidate_secure_token"
`;
  fs.writeFileSync(wranglerTomlFile, tomlContent);
  console.log('[prepare-pages] Created default wrangler.toml with [vars]');
}

console.log('[prepare-pages] Cloudflare Pages/Worker bundle preparation complete!');
