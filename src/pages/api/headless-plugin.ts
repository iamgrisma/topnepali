import type { APIRoute } from 'astro';
import { deflateRawSync } from 'node:zlib';
import pluginRawCode from '../../../wp-plugin/headless/headless.php?raw';
import { REVALIDATE_SECRET } from '../../config';

// Extract version dynamically from plugin code header
const versionMatch = pluginRawCode.match(/Version:\s*([0-9\.]+)/i);
const PLUGIN_VERSION = versionMatch ? versionMatch[1] : '1.3.0';

// Precompute CRC-32 table for zip archive assembly
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

function computeCrc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

interface ZipEntry {
  name: string;
  content: string | Uint8Array;
}

function createZipBuffer(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBuf = Buffer.from(entry.name, 'utf8');
    const rawData = typeof entry.content === 'string' ? Buffer.from(entry.content, 'utf8') : Buffer.from(entry.content);
    const compressedData = deflateRawSync(rawData);
    const checksum = computeCrc32(rawData);

    // Local file header (30 bytes + filename)
    const local = Buffer.alloc(30 + filenameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // Local header signature
    local.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
    local.writeUInt16LE(0, 6);          // General purpose bit flag
    local.writeUInt16LE(8, 8);          // Compression method (8 = Deflate)
    local.writeUInt16LE(0, 10);         // Mod time
    local.writeUInt16LE(0, 12);         // Mod date
    local.writeUInt32LE(checksum, 14);  // CRC-32
    local.writeUInt32LE(compressedData.length, 18); // Compressed size
    local.writeUInt32LE(rawData.length, 22);        // Uncompressed size
    local.writeUInt16LE(filenameBuf.length, 26);    // File name length
    local.writeUInt16LE(0, 28);         // Extra field length
    filenameBuf.copy(local, 30);

    // Central directory header (46 bytes + filename)
    const central = Buffer.alloc(46 + filenameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // Central directory signature
    central.writeUInt16LE(20, 4);         // Version made by
    central.writeUInt16LE(20, 6);         // Version needed to extract
    central.writeUInt16LE(0, 8);          // General purpose bit flag
    central.writeUInt16LE(8, 10);         // Compression method (8 = Deflate)
    central.writeUInt16LE(0, 12);         // Mod time
    central.writeUInt16LE(0, 14);         // Mod date
    central.writeUInt32LE(checksum, 16);  // CRC-32
    central.writeUInt32LE(compressedData.length, 20); // Compressed size
    central.writeUInt32LE(rawData.length, 24);        // Uncompressed size
    central.writeUInt16LE(filenameBuf.length, 28);    // File name length
    central.writeUInt16LE(0, 30);         // Extra field length
    central.writeUInt16LE(0, 32);         // Comment length
    central.writeUInt16LE(0, 34);         // Disk number start
    central.writeUInt16LE(0, 36);         // Internal file attributes
    central.writeUInt32LE(0, 38);         // External file attributes
    central.writeUInt32LE(offset, 42);    // Relative offset of local header
    filenameBuf.copy(central, 46);

    localHeaders.push(local, compressedData);
    centralHeaders.push(central);
    offset += local.length + compressedData.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((sum, b) => sum + b.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);    // EOCD signature
  eocd.writeUInt16LE(0, 4);             // Disk number
  eocd.writeUInt16LE(0, 6);             // Central directory disk
  eocd.writeUInt16LE(entries.length, 8); // Number of records on this disk
  eocd.writeUInt16LE(entries.length, 10);// Total records
  eocd.writeUInt32LE(centralDirSize, 12);   // Central directory size
  eocd.writeUInt32LE(centralDirOffset, 16); // Central directory offset
  eocd.writeUInt16LE(0, 20);            // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

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

  const action = url.searchParams.get('action');
  const isInfo = action === 'info' || url.searchParams.has('info');
  const isRaw = action === 'raw' || url.searchParams.has('raw');

  const origin = url.origin;
  const downloadUrl = `${origin}/api/headless-plugin?action=download&secret=${encodeURIComponent(reqSecret)}`;

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
        requires_php: '7.4',
        last_updated: new Date().toISOString(),
        sections: {
          description: 'High-performance Headless WordPress engine for Astro & Cloudflare Edge. Provides automatic on-demand cache revalidation, preview rewrites, Rank Math head bridge, and REST API edge caching.',
          changelog: `v${PLUGIN_VERSION}: Native WordPress core zip package updates with zero security scanner false positives.`,
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

  if (isRaw) {
    // Return the raw PHP file content if requested
    return new Response(pluginRawCode, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'inline; filename="topnepali-headless.php"',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Plugin-Version': PLUGIN_VERSION,
      },
    });
  }

  // Default: Return standard WordPress plugin ZIP archive for native Plugin_Upgrader
  const zipBuffer = createZipBuffer([
    {
      name: 'topnepali-headless/topnepali-headless.php',
      content: pluginRawCode,
    },
    {
      name: 'topnepali-headless/index.php',
      content: '<?php\n// Silence is golden.\n',
    },
    {
      name: 'topnepali-headless/readme.txt',
      content: `=== TopNepali Headless Engine ===
Contributors: topnepali
Donate link: https://topnepali.com
Tags: headless, astro, cloudflare, cache-revalidation
Requires at least: 5.6
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: ${PLUGIN_VERSION}
License: GPLv2 or later

High-performance Headless WordPress engine for Astro & Cloudflare Edge.
`,
    },
  ]);

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="topnepali-headless.zip"',
      'Content-Length': String(zipBuffer.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Plugin-Version': PLUGIN_VERSION,
    },
  });
};
