import type {
  WPPost,
  WPPage,
  WPCategory,
  WPTag,
  WPSiteInfo,
  PaginationResult
} from '../types/wp';

import { WP_URL } from '../config';

export function getWpBaseUrl(): string {
  return WP_URL;
}

// In-memory cache for SSR performance (24 hours TTL, purged on-demand via /api/revalidate)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (cleared via clearWpCache on webhook)

export function clearWpCache(pattern?: string): number {
  if (!pattern) {
    const size = cache.size;
    cache.clear();
    return size;
  }
  let cleared = 0;
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      cleared++;
    }
  }
  return cleared;
}

async function fetchWithCache<T>(
  url: string,
  headersInit?: Record<string, string>,
  cfTtl: number = 3600
): Promise<{ data: T; headers: Headers }> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return { data: cached.data.data, headers: cached.data.headers };
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TopNepali-Headless-Astro/1.0',
      'Accept': 'application/json',
      ...headersInit,
    },
    // Instruct Cloudflare Edge network to cache backend WordPress REST API responses
    cf: {
      cacheTtl: cfTtl,
      cacheEverything: true,
    } as any,
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { data: null as any, headers: response.headers };
    }
    throw new Error(`WordPress API Error ${response.status}: ${response.statusText} for ${url}`);
  }

  const data = await response.json();
  const result = { data, headers: response.headers };
  cache.set(url, { data: result, timestamp: now });
  return result;
}

export const DEFAULT_TOP_CATEGORIES: WPCategory[] = [
  { id: 26, name: 'Education', slug: 'education', count: 19, description: 'Education & Routines', link: '/category/education', taxonomy: 'category', parent: 0 },
  { id: 29, name: 'Exam Routines', slug: 'exam-routines', count: 18, description: 'Exam Routines', link: '/category/exam-routines', taxonomy: 'category', parent: 0 },
  { id: 30, name: 'Exam Form', slug: 'exam-form', count: 8, description: 'Exam Forms', link: '/category/exam-form', taxonomy: 'category', parent: 0 },
  { id: 112, name: 'Loksewa', slug: 'loksewa', count: 3, description: 'Loksewa Notices', link: '/category/loksewa', taxonomy: 'category', parent: 0 },
  { id: 128, name: 'Vacancy', slug: 'vacancy', count: 8, description: 'Job Vacancies', link: '/category/vacancy', taxonomy: 'category', parent: 0 },
  { id: 161, name: 'Bachelor 2nd Year', slug: 'bachelor-2nd-year', count: 5, description: 'Bachelor Second Year', link: '/category/bachelor-2nd-year', taxonomy: 'category', parent: 0 },
  { id: 150, name: 'Bachelor First Year', slug: 'bachelor-first-year-exam-routine', count: 7, description: 'Bachelor First Year', link: '/category/bachelor-first-year-exam-routine', taxonomy: 'category', parent: 0 },
  { id: 76, name: 'Finance', slug: 'finance', count: 8, description: 'Finance & Banking', link: '/category/finance', taxonomy: 'category', parent: 0 },
  { id: 91, name: 'Share Market', slug: 'share-market', count: 4, description: 'Share Market & NEPSE', link: '/category/share-market', taxonomy: 'category', parent: 0 },
  { id: 133, name: 'Nepali Rappers', slug: 'rappers', count: 4, description: 'Nepali Rappers & Hip Hop', link: '/category/rappers', taxonomy: 'category', parent: 0 },
  { id: 166, name: 'General Knowledge', slug: 'general-knowledge', count: 4, description: 'GK & Civil Service', link: '/category/general-knowledge', taxonomy: 'category', parent: 0 },
  { id: 1, name: 'TopNepali', slug: 'topnepali', count: 23, description: 'Top Nepali Articles', link: '/category/topnepali', taxonomy: 'category', parent: 0 },
];

/**
 * Fetch general site information — instant synchronous resolution
 */
export function getSiteInfo(): WPSiteInfo {
  return {
    name: 'Top Nepali',
    description: 'Covering Top Nepali News, Updates, Educational Information',
    url: 'https://topnepali.com',
  };
}

/**
 * Fetch paginated posts with optional category, tag, search or exclusion filters
 */
export interface GetPostsOptions {
  page?: number;
  perPage?: number;
  category?: number | string;
  tag?: number | string;
  search?: string;
  exclude?: number[];
  order?: 'asc' | 'desc';
  orderby?: 'date' | 'relevance' | 'title' | 'id';
  fields?: string;
}

export async function getPosts(options: GetPostsOptions = {}): Promise<PaginationResult<WPPost>> {
  const base = getWpBaseUrl();
  const {
    page = 1,
    perPage = 10,
    category,
    tag,
    search,
    exclude,
    order = 'desc',
    orderby = 'date',
    fields,
  } = options;

  const params = new URLSearchParams({
    _embed: '1',
    page: String(page),
    per_page: String(perPage),
    order,
    orderby,
  });

  // Prune unused heavy content.rendered, head, and seo for list queries (drastically reduces JSON payload size and DB work)
  if (fields) {
    params.set('_fields', fields);
  } else {
    params.set('_fields', 'id,date,modified,slug,status,type,link,title,excerpt,featured_media,categories,tags,_links,_embedded');
  }

  if (category) {
    // If category is a slug, resolve it to an ID first
    if (typeof category === 'string' && isNaN(Number(category))) {
      const catObj = await getCategoryBySlug(category);
      if (catObj) {
        params.set('categories', String(catObj.id));
      } else {
        return { data: [], total: 0, totalPages: 0, currentPage: page };
      }
    } else {
      params.set('categories', String(category));
    }
  }

  if (tag) {
    if (typeof tag === 'string' && isNaN(Number(tag))) {
      const tagObj = await getTagBySlug(tag);
      if (tagObj) {
        params.set('tags', String(tagObj.id));
      } else {
        return { data: [], total: 0, totalPages: 0, currentPage: page };
      }
    } else {
      params.set('tags', String(tag));
    }
  }

  if (search) {
    params.set('search', search);
  }

  if (exclude && exclude.length > 0) {
    params.set('exclude', exclude.join(','));
  }

  const url = `${base}/wp-json/wp/v2/posts?${params.toString()}`;

  try {
    const { data, headers } = await fetchWithCache<WPPost[]>(url);
    const total = parseInt(headers.get('x-wp-total') || '0', 10) || (Array.isArray(data) ? data.length : 0);
    const totalPages = parseInt(headers.get('x-wp-totalpages') || '1', 10) || 1;

    return {
      data: Array.isArray(data) ? data : [],
      total,
      totalPages,
      currentPage: page,
    };
  } catch (err) {
    console.error('getPosts error:', err);
    return { data: [], total: 0, totalPages: 0, currentPage: page };
  }
}

/**
 * Fetch a single post by slug
 */
export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const base = getWpBaseUrl();
  const url = `${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=1`;
  try {
    const { data } = await fetchWithCache<WPPost[]>(url);
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return null;
  } catch (err) {
    console.error(`getPostBySlug (${slug}) error:`, err);
    return null;
  }
}

/**
 * Fetch a single page by slug
 */
export async function getPageBySlug(slug: string): Promise<WPPage | null> {
  const base = getWpBaseUrl();
  const url = `${base}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&_embed=1`;
  try {
    const { data } = await fetchWithCache<WPPage[]>(url);
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return null;
  } catch (err) {
    console.error(`getPageBySlug (${slug}) error:`, err);
    return null;
  }
}

/**
 * Fetch list of categories
 */
export async function getCategories(options: { perPage?: number; hideEmpty?: boolean } = {}): Promise<WPCategory[]> {
  const base = getWpBaseUrl();
  const { perPage = 50, hideEmpty = true } = options;
  const params = new URLSearchParams({
    per_page: String(perPage),
    hide_empty: hideEmpty ? 'true' : 'false',
    orderby: 'count',
    order: 'desc',
    _fields: 'id,count,description,link,name,slug,taxonomy,parent',
  });

  const url = `${base}/wp-json/wp/v2/categories?${params.toString()}`;
  try {
    const { data } = await fetchWithCache<WPCategory[]>(url, undefined, 86400);
    return Array.isArray(data) && data.length > 0 ? data : DEFAULT_TOP_CATEGORIES;
  } catch (err) {
    console.warn('getCategories falling back to static top categories:', err);
    return DEFAULT_TOP_CATEGORIES;
  }
}

/**
 * Fetch category by slug — instant local resolution for top categories
 */
export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const cleanSlug = slug.toLowerCase().trim();
  const matched = DEFAULT_TOP_CATEGORIES.find((c) => c.slug === cleanSlug);
  if (matched) return matched;

  const base = getWpBaseUrl();
  const url = `${base}/wp-json/wp/v2/categories?slug=${encodeURIComponent(cleanSlug)}&_fields=id,count,description,link,name,slug,taxonomy,parent`;
  try {
    const { data } = await fetchWithCache<WPCategory[]>(url, undefined, 86400);
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return null;
  } catch (err) {
    console.error(`getCategoryBySlug (${slug}) error:`, err);
    return null;
  }
}

/**
 * Fetch tags
 */
export async function getTags(options: { perPage?: number } = {}): Promise<WPTag[]> {
  const base = getWpBaseUrl();
  const { perPage = 30 } = options;
  const params = new URLSearchParams({
    per_page: String(perPage),
    orderby: 'count',
    order: 'desc',
  });
  const url = `${base}/wp-json/wp/v2/tags?${params.toString()}`;
  try {
    const { data } = await fetchWithCache<WPTag[]>(url);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('getTags error:', err);
    return [];
  }
}

/**
 * Fetch tag by slug
 */
export async function getTagBySlug(slug: string): Promise<WPTag | null> {
  const base = getWpBaseUrl();
  const url = `${base}/wp-json/wp/v2/tags?slug=${encodeURIComponent(slug)}`;
  try {
    const { data } = await fetchWithCache<WPTag[]>(url);
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return null;
  } catch (err) {
    console.error(`getTagBySlug (${slug}) error:`, err);
    return null;
  }
}

/**
 * Fetch recent posts for sidebar widget
 */
export async function getRecentPosts(limit: number = 5): Promise<WPPost[]> {
  const res = await getPosts({
    perPage: limit,
    page: 1,
    fields: 'id,date,slug,title,featured_media,_links,_embedded',
  });
  return res.data;
}

// ---------------------------------------------------------------------
// Presentation Helper Utilities
// ---------------------------------------------------------------------

export function getPostFeaturedImage(post: WPPost | WPPage): { url: string; alt: string; width?: number; height?: number } | null {
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  if (!media || !media.source_url) return null;
  return {
    url: media.source_url,
    alt: media.alt_text || post.title?.rendered || 'Post thumbnail',
    width: media.media_details?.width,
    height: media.media_details?.height,
  };
}

export function getPostAuthor(post: WPPost): { name: string; avatar?: string; url?: string; description?: string } {
  const author = post._embedded?.author?.[0];
  if (!author) {
    return { name: 'Top Nepali Editorial', avatar: undefined };
  }
  const avatar = author.avatar_urls?.['96'] || author.avatar_urls?.['48'] || author.avatar_urls?.['24'];
  return {
    name: author.name || 'Top Nepali',
    avatar,
    url: author.link,
    description: author.description,
  };
}

export function getPostCategories(post: WPPost): { id: number; name: string; slug: string }[] {
  const terms = post._embedded?.['wp:term']?.[0] || [];
  return terms.map(t => ({
    id: t.id,
    name: decodeHtmlEntities(t.name),
    slug: t.slug,
  }));
}

export function getPostTags(post: WPPost): { id: number; name: string; slug: string }[] {
  const terms = post._embedded?.['wp:term']?.[1] || [];
  return terms.map(t => ({
    id: t.id,
    name: decodeHtmlEntities(t.name),
    slug: t.slug,
  }));
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function estimateReadingTime(content: string): string {
  if (!content) return '1 min read';
  const clean = content.replace(/<[^>]+>/g, ' ');
  const words = clean.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

/**
 * Optimize and debloat WordPress post/page HTML content:
 * - Strips Gutenberg comment markers (<!-- wp:... --> and <!-- /wp:... -->)
 * - Removes empty paragraphs (<p>&nbsp;</p>, <p></p>, <p><br></p>)
 * - Strips legacy inline font-family, font-size, and conflicting color styles
 * - Injects loading="lazy" and decoding="async" to images missing it
 * - Wraps <table> in an accessible, responsive overflow container
 * - Normalizes excessive line breaks
 */
export function optimizeWpHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  let html = rawHtml;

  // 1. Remove WordPress Gutenberg block comments
  html = html.replace(/<!--\s*\/?wp:[^>]*-->/gi, '');

  // 2. Remove empty paragraphs and line breaks
  html = html.replace(/<p>\s*(?:&nbsp;|<br\s*\/?>|\s)*<\/p>/gi, '');

  // 3. Strip inline style attributes that override clean typography
  html = html.replace(/\s*style="([^"]*)"/gi, (match, styleContent) => {
    const hasAlign = styleContent.match(/text-align:\s*[^;]+/i);
    return hasAlign ? ` style="${hasAlign[0]}"` : '';
  });

  // 4. Optimize <img> tags: ensure loading="lazy" and decoding="async"
  html = html.replace(/<img\b([^>]*?)>/gi, (match, attrs) => {
    let newAttrs = attrs;
    if (!/loading\s*=/i.test(newAttrs)) {
      newAttrs += ' loading="lazy"';
    }
    if (!/decoding\s*=/i.test(newAttrs)) {
      newAttrs += ' decoding="async"';
    }
    return `<img${newAttrs}>`;
  });

  // 5. Wrap <table> tags in responsive container
  html = html.replace(/<table\b([\s\S]*?)<\/table>/gi, (match) => {
    return `<div class="overflow-x-auto my-6 rounded-lg border border-slate-200 shadow-2xs">${match}</div>`;
  });

  // 6. Clean up duplicate line breaks
  html = html.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');

  return html.trim();
}

/**
 * Resolves Rank Math template variables (%title%, %currentyear%, %sep%, %sitename%, %excerpt%, etc.)
 * Strips leaked placeholders so raw template strings like "%title% (%currentyear%) %page% %sep% %sitename%"
 * never show up in browser titles, social tags, or search engine snippets.
 */
export function resolveRankMathVariables(
  template: string | null | undefined,
  context: {
    title?: string;
    excerpt?: string;
    siteName?: string;
    separator?: string;
    category?: string;
  }
): string {
  if (!template || typeof template !== 'string') return '';
  const now = new Date();
  const siteName = context.siteName || 'Top Nepali';
  const sep = context.separator || '—';
  const cleanTitle = context.title ? decodeHtmlEntities(stripHtml(context.title)) : '';
  const cleanExcerpt = context.excerpt ? decodeHtmlEntities(stripHtml(context.excerpt)) : '';

  let resolved = template
    .replace(/%title%/gi, cleanTitle)
    .replace(/%currentyear%/gi, String(now.getFullYear()))
    .replace(/%currentmonth%/gi, now.toLocaleString('en-US', { month: 'long' }))
    .replace(/%currentday%/gi, String(now.getDate()))
    .replace(/%sep%/gi, sep)
    .replace(/%sitename%/gi, siteName)
    .replace(/%page%/gi, '')
    .replace(/%category%/gi, context.category || '')
    .replace(/%excerpt%/gi, cleanExcerpt)
    .replace(/%focuskw%/gi, '')
    .replace(/%customfield\([^)]+\)%/gi, '')
    .replace(/%[a-z0-9_-]+%/gi, '') // Strip any unknown Rank Math variables
    .replace(/\s+/g, ' ')
    .trim();

  // If the string was solely empty placeholders or just leftover separators, return the clean title
  if (!resolved || resolved === sep || resolved === `${sep} ${siteName}`) {
    return cleanTitle;
  }

  return resolved;
}

