import type {
  WPPost,
  WPPage,
  WPCategory,
  WPTag,
  WPSiteInfo,
  PaginationResult
} from '../types/wp';

// Configurable WordPress endpoint — defaults to topnepali.com or any WP blog
const DEFAULT_WP_URL = 'https://topnepali.com';

export function getWpBaseUrl(): string {
  const envUrl =
    (typeof process !== 'undefined' && process.env?.WORDPRESS_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.WORDPRESS_URL);
  const raw = envUrl || DEFAULT_WP_URL;
  return raw.replace(/\/+$/, '');
}

// In-memory cache for SSR performance (60 seconds TTL for fast updates without static build rebuilds)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

async function fetchWithCache<T>(url: string, headersInit?: Record<string, string>): Promise<{ data: T; headers: Headers }> {
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

/**
 * Fetch general site information from WP REST root
 */
export async function getSiteInfo(): Promise<WPSiteInfo> {
  const base = getWpBaseUrl();
  try {
    const { data } = await fetchWithCache<WPSiteInfo>(`${base}/wp-json/`);
    return {
      name: data?.name || 'Top Nepali',
      description: data?.description || 'Covering Top Nepali News, Updates, Educational Information',
      url: data?.url || base,
    };
  } catch (error) {
    console.error('Failed to fetch WP site info:', error);
    return {
      name: 'Top Nepali',
      description: 'Covering Top Nepali News, Updates, Educational Information',
      url: base,
    };
  }
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
  } = options;

  const params = new URLSearchParams({
    _embed: '1',
    page: String(page),
    per_page: String(perPage),
    order,
    orderby,
  });

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
  });

  const url = `${base}/wp-json/wp/v2/categories?${params.toString()}`;
  try {
    const { data } = await fetchWithCache<WPCategory[]>(url);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('getCategories error:', err);
    return [];
  }
}

/**
 * Fetch category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const base = getWpBaseUrl();
  const url = `${base}/wp-json/wp/v2/categories?slug=${encodeURIComponent(slug)}`;
  try {
    const { data } = await fetchWithCache<WPCategory[]>(url);
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
  const res = await getPosts({ perPage: limit, page: 1 });
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
