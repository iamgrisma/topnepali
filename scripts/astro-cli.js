#!/usr/bin/env node
// Wrapper to ensure astro CLI works reliably across Node 20+ and Node 22+ environments
// Includes critical Android/Termux compatibility hooks for esbuild, satteri, workerd, and WASI
if (process.versions.node && parseInt(process.versions.node.split('.')[0], 10) < 22) {
  try {
    Object.defineProperty(process.versions, 'node', { value: '22.12.0' });
  } catch {}
}

import Module from 'node:module';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

// Load .env variables into process.env for local development and build
try {
  const fs = require('node:fs');
  const path = require('node:path');
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (typeof process.env[key] === 'undefined') {
          process.env[key] = val;
        }
      }
    }
  }
} catch {}

// Ensure Astro runs dev/preview in the current process so Termux hooks and env stay intact
process.env.ASTRO_DEV_BACKGROUND = '1';
process.env.ASTRO_PREVIEW_BACKGROUND = '1';

// Intercept native .node loading on Android/Termux so bionic namespace restrictions don't block dlopen
const isAndroidArm64 = process.platform === 'android' && process.arch === 'arm64';
if (isAndroidArm64) {
  try {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const crypto = require('node:crypto');
    const tmpDir = path.join(os.tmpdir(), 'termux_native_bindings');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // Ensure esbuild executable is run from Termux internal storage (since /sdcard has noexec)
    const esbuildSrc = path.join(process.cwd(), 'node_modules/@esbuild/android-arm64/bin/esbuild');
    const esbuildDst = path.join(os.tmpdir(), 'esbuild');
    if (fs.existsSync(esbuildSrc)) {
      if (!fs.existsSync(esbuildDst) || fs.statSync(esbuildSrc).size !== fs.statSync(esbuildDst).size) {
        fs.copyFileSync(esbuildSrc, esbuildDst);
        fs.chmodSync(esbuildDst, 0o755);
      }
      process.env.ESBUILD_BINARY_PATH = esbuildDst;
    }

    // Transparently copy any .node file from /sdcard or /storage to Termux internal storage before dlopen
    const origDotNode = Module._extensions['.node'];
    Module._extensions['.node'] = function(module, filename) {
      if (filename.startsWith('/storage/emulated/') || filename.startsWith('/sdcard/')) {
        const hash = crypto.createHash('md5').update(filename).digest('hex').slice(0, 8);
        const basename = path.basename(filename);
        const tmpFile = path.join(tmpDir, `${hash}-${basename}`);
        if (!fs.existsSync(tmpFile) || fs.statSync(filename).size !== fs.statSync(tmpFile).size) {
          fs.copyFileSync(filename, tmpFile);
        }
        return process.dlopen(module, tmpFile);
      }
      return origDotNode(module, filename);
    };

    const origLoad = Module._load;
    Module._load = function(request, parent, isMain) {
      if (request === 'satteri' || (typeof request === 'string' && request.includes('satteri'))) {
        return {};
      }
      if (request === 'workerd' || (typeof request === 'string' && request.includes('workerd/lib/main.js'))) {
        return {
          compatibilityDate: '2026-09-15',
          version: '1.20260915.1',
          binPath: '/bin/sh',
          default: '/bin/sh'
        };
      }
      return origLoad.apply(this, arguments);
    };

    const origRequire = Module.prototype.require;
    Module.prototype.require = function(id) {
      if (id === 'satteri' || (typeof id === 'string' && id.includes('satteri'))) {
        return {};
      }
      if (id === 'workerd' || (typeof id === 'string' && id.endsWith('/workerd/lib/main.js'))) {
        return {
          compatibilityDate: '2026-09-15',
          version: '1.20260915.1',
          binPath: '/bin/sh',
          default: '/bin/sh'
        };
      }
      return origRequire.apply(this, arguments);
    };
  } catch (err) {
    console.error('Android native binding hook error:', err);
  }
}

// Fix WASI preopens for Android/Termux environments where root '/' is inaccessible
try {
  const wasiMod = require('node:wasi');
  const OrigWASI = wasiMod.WASI;
  wasiMod.WASI = function(opts) {
    if (opts && opts.preopens) {
      opts = { ...opts, preopens: { [process.cwd()]: process.cwd() } };
    }
    return new OrigWASI(opts);
  };
} catch {}

// Flag processing
const cfIndex = process.argv.indexOf('--cloudflare');
if (cfIndex !== -1) {
  process.env.DEPLOY_TARGET = 'cloudflare';
  process.argv.splice(cfIndex, 1);
}

const nodeIndex = process.argv.indexOf('--node');
if (nodeIndex !== -1) {
  process.env.DEPLOY_TARGET = 'node';
  process.argv.splice(nodeIndex, 1);
}

const isBuild = process.argv.includes('build');


// Graceful fallback for optional satteri native binding on Android/Termux
try {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const satteriPath = path.join(process.cwd(), 'node_modules/satteri/index.js');
  if (fs.existsSync(satteriPath)) {
    let content = fs.readFileSync(satteriPath, 'utf8');
    if (content.includes('if (!nativeBinding) {') && !content.includes('nativeBinding = new Proxy')) {
      content = content.replace(
        'if (!nativeBinding) {',
        'if (!nativeBinding) {\n  nativeBinding = new Proxy({}, { get: () => () => ({}) });\n} else if (false) {'
      );
      fs.writeFileSync(satteriPath, content);
    }
  }
} catch {}

let cliUrl;
try {
  const astroPkg = require.resolve('astro/package.json');
  cliUrl = new URL('./dist/cli/index.js', pathToFileURL(astroPkg));
} catch {
  cliUrl = new URL('../node_modules/astro/dist/cli/index.js', import.meta.url);
}

const { cli } = await import(cliUrl);
await cli(process.argv);

if (isBuild && process.env.DEPLOY_TARGET === 'cloudflare') {
  try {
    await import('./prepare-pages.js');
  } catch (err) {
    console.warn('[astro-cli] prepare-pages warning:', err);
  }
}
