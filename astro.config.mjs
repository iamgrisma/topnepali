import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import cloudflare from '@astrojs/cloudflare';

const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare' || Boolean(process.env.CF_PAGES);

// https://astro.build/config
export default defineConfig({
  site: 'https://topnepali.com',
  output: 'server',
  session: false,
  security: {
    checkOrigin: false,
  },
  adapter: isCloudflare ? cloudflare({ imageService: 'passthrough' }) : node({ mode: 'standalone' }),
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        usePolling: true,
      },
    },
  },
});
