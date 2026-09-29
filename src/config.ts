// Central site configuration for Top Nepali
// Reads from Cloudflare / Node runtime environment if present, otherwise uses site defaults.

const env =
  (typeof globalThis !== 'undefined' && (globalThis as any).__CF_ENV__) ||
  (typeof process !== 'undefined' ? process.env : {}) ||
  {};

export const SITE_URL: string = (env.URL || 'https://topnepali.com').replace(/\/+$/, '');
export const WP_URL: string = (env.WORDPRESS_URL || env.WP_URL || 'https://wp.topnepali.com').replace(/\/+$/, '');
export const GTM_ID: string = env.PUBLIC_GTM_ID || 'GTM-MD2NWFJ';
export const GA_ID: string = env.PUBLIC_GA_ID || 'G-K2R0GSQE0M';
export const ADSENSE_ID: string = env.PUBLIC_ADSENSE_ID || 'ca-pub-5410507143596599';
export const REVALIDATE_SECRET: string = env.REVALIDATE_SECRET || 'topnepali_revalidate_secure_token';
export const POSTS_PER_PAGE: number = parseInt(env.POSTS_PER_PAGE || '10', 10) || 10;
