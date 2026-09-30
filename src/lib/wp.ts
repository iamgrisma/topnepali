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

// In-memory cache for SSR performance (3 minutes TTL, purged on-demand via /api/revalidate)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes (deduplicates concurrent SSR renders without trapping stale data)

export function clearWpCache(pattern?: string): number {
  if (!pattern || pattern === 'all') {
    const size = cache.size;
    cache.clear();
    return size;
  }
  let cleared = 0;
  for (const key of cache.keys()) {
    // If a pattern or slug is provided, clear matching keys AND all post/tax collection keys
    // because list queries (/wp/v2/posts) do NOT contain the individual post slug!
    if (
      key.includes(pattern) ||
      key.includes('/wp/v2/posts') ||
      key.includes('/wp/v2/categories') ||
      key.includes('/wp/v2/tags')
    ) {
      cache.delete(key);
      cleared++;
    }
  }
  return cleared;
}

async function fetchWithCache<T>(
  url: string,
  headersInit?: Record<string, string>,
  cfTtl: number = 60
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
    params.set('_fields', 'id,date,modified,slug,status,type,link,title,excerpt,featured_media,categories,tags,reading_time,_links,_embedded');
  }

  if (category) {
    let catId: number | null = null;
    // If category is a slug, resolve it to an ID first
    if (typeof category === 'string' && isNaN(Number(category))) {
      const catObj = await getCategoryBySlug(category);
      if (catObj) {
        catId = catObj.id;
      } else {
        return { data: [], total: 0, totalPages: 0, currentPage: page };
      }
    } else {
      catId = Number(category);
    }

    if (catId) {
      // Include parent category and all child subcategories (WordPress core 'include_children' behavior)
      const descendantIds = await getCategoryAndDescendantIds(catId);
      params.set('categories', descendantIds.join(','));
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
 * Fetch all categories with edge / in-memory cache and recursive padded counts
 */
export async function getAllCategories(): Promise<WPCategory[]> {
  const base = getWpBaseUrl();
  const url = `${base}/wp-json/wp/v2/categories?per_page=100&_fields=id,count,description,link,name,slug,taxonomy,parent`;
  try {
    const { data } = await fetchWithCache<WPCategory[]>(url, undefined, 86400);
    const rawCategories = Array.isArray(data) && data.length > 0 ? data : DEFAULT_TOP_CATEGORIES;

    // Pad counts recursively so parent categories accurately reflect total posts under them
    return rawCategories.map((c) => {
      const descIds: number[] = [c.id];
      function collect(pid: number) {
        for (const item of rawCategories) {
          if (item.parent === pid && !descIds.includes(item.id)) {
            descIds.push(item.id);
            collect(item.id);
          }
        }
      }
      collect(c.id);

      if (descIds.length === 1) return c; // Leaf category, keep exact count

      const totalRecursiveCount = rawCategories
        .filter((item) => descIds.includes(item.id))
        .reduce((sum, item) => sum + (item.count || 0), 0);

      return {
        ...c,
        count: Math.max(c.count || 0, totalRecursiveCount),
      };
    });
  } catch (err) {
    console.warn('getAllCategories error, falling back to static:', err);
    return DEFAULT_TOP_CATEGORIES;
  }
}

/**
 * Returns the category ID and all its recursive descendant child category IDs.
 * Matches WordPress core's native WP_Query 'include_children' => true behavior.
 */
export async function getCategoryAndDescendantIds(categoryId: number): Promise<number[]> {
  const allCategories = await getAllCategories();
  const ids: number[] = [categoryId];

  function collectChildren(parentId: number) {
    for (const cat of allCategories) {
      if (cat.parent === parentId && !ids.includes(cat.id)) {
        ids.push(cat.id);
        collectChildren(cat.id);
      }
    }
  }

  collectChildren(categoryId);
  return ids;
}

/**
 * Fetch list of categories (sorted by post count)
 */
export async function getCategories(options: { perPage?: number; hideEmpty?: boolean } = {}): Promise<WPCategory[]> {
  const { perPage = 50, hideEmpty = true } = options;
  const allCategories = await getAllCategories();
  let list = allCategories;
  if (hideEmpty) {
    list = list.filter((c) => (c.count || 0) > 0);
  }
  list.sort((a, b) => (b.count || 0) - (a.count || 0));
  return list.slice(0, perPage);
}

/**
 * Fetch category by slug — uses cached full category tree for instant resolution with correct parent and padded count
 */
export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const cleanSlug = slug.toLowerCase().trim();
  const allCategories = await getAllCategories();
  const found = allCategories.find((c) => c.slug === cleanSlug);
  if (found) return found;

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

// Presentation Helper Utilities
export function getPostTitle(post: WPPost | WPPage | { title?: { rendered?: string } } | string | null | undefined): string {
  if (!post) return '';
  const raw = typeof post === 'string' ? post : (post.title?.rendered || '');
  return stripHtml(raw);
}

export function getPostFeaturedImage(post: WPPost | WPPage): { url: string; alt: string; width?: number; height?: number } | null {
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  if (!media || !media.source_url) return null;
  return {
    url: media.source_url,
    alt: media.alt_text ? decodeHtmlEntities(media.alt_text) : (getPostTitle(post) || 'Post thumbnail'),
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

export function estimateReadingTime(content: string | WPPost | null | undefined): string {
  if (!content) return '1 min read';
  let text = '';
  if (typeof content === 'object') {
    if (content.reading_time) return content.reading_time;
    text = content.content?.rendered || content.excerpt?.rendered || '';
  } else {
    text = String(content);
  }
  const clean = text.replace(/<[^>]+>/g, ' ');
  const words = clean.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return '1 min read';
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  let str = text;
  // Multi-pass to cleanly decode nested or double-escaped entities (e.g. &amp;#038; -> &#038; -> &)
  for (let i = 0; i < 3; i++) {
    const prev = str;
    str = str
      .replace(/&#8211;|&ndash;/g, '–')
      .replace(/&#8212;|&mdash;/g, '—')
      .replace(/&#8216;|&lsquo;/g, "'")
      .replace(/&#8217;|&rsquo;/g, "'")
      .replace(/&#8220;|&ldquo;/g, '"')
      .replace(/&#8221;|&rdquo;/g, '"')
      .replace(/&#8230;|&hellip;/g, '…')
      .replace(/&#038;|&#38;|&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#([0-9]+);/g, (_, code) => {
        try {
          return String.fromCharCode(parseInt(code, 10));
        } catch {
          return _;
        }
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
        try {
          return String.fromCharCode(parseInt(code, 16));
        } catch {
          return _;
        }
      });
    if (str === prev) break;
  }
  return str;
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

  // 1. Rewrite any WordPress backend links (wp.topnepali.com) to the public frontend (topnepali.com)
  html = html.replace(/https?:\/\/wp\.topnepali\.com/gi, 'https://topnepali.com');

  // 2. Remove WordPress Gutenberg block comments
  html = html.replace(/<!--\s*\/?wp:[^>]*-->/gi, '');

  // 3. Remove empty paragraphs and line breaks
  html = html.replace(/<p>\s*(?:&nbsp;|<br\s*\/?>|\s)*<\/p>/gi, '');

  // 4. Strip inline style attributes that override clean typography
  html = html.replace(/\s*style="([^"]*)"/gi, (match, styleContent) => {
    const hasAlign = styleContent.match(/text-align:\s*[^;]+/i);
    return hasAlign ? ` style="${hasAlign[0]}"` : '';
  });

  // 5. Optimize <img> tags: ensure loading="lazy", decoding="async", and explicit dimensions/aspect-ratio to eliminate CLS
  html = html.replace(/<img\b([^>]*?)>/gi, (match, attrs) => {
    let newAttrs = attrs;
    if (!/loading\s*=/i.test(newAttrs)) {
      newAttrs += ' loading="lazy"';
    }
    if (!/decoding\s*=/i.test(newAttrs)) {
      newAttrs += ' decoding="async"';
    }

    const hasWidth = /\bwidth\s*=/i.test(newAttrs);
    const hasHeight = /\bheight\s*=/i.test(newAttrs);
    if (!hasWidth || !hasHeight) {
      // Try to parse dimensions from WordPress image URLs like ...-1200x630.jpg or ...-768x403.png
      const dimMatch = newAttrs.match(/src=["'][^"']*-(\d{2,4})x(\d{2,4})\.(?:jpe?g|png|webp|avif)/i);
      if (dimMatch && dimMatch[1] && dimMatch[2]) {
        if (!hasWidth) newAttrs += ` width="${dimMatch[1]}"`;
        if (!hasHeight) newAttrs += ` height="${dimMatch[2]}"`;
      } else if (!/aspect-ratio/i.test(newAttrs)) {
        // Fallback layout shift guard
        newAttrs += ' style="aspect-ratio: 16/9; max-width: 100%; height: auto;"';
      }
    }

    return `<img${newAttrs}>`;
  });

  // 6. Wrap <table> tags in responsive container
  html = html.replace(/<table\b([\s\S]*?)<\/table>/gi, (match) => {
    return `<div class="overflow-x-auto my-6 rounded-lg border border-slate-200 shadow-2xs">${match}</div>`;
  });

  // 7. Make <iframe> embeds responsive (YouTube, Vimeo, etc.) with minimal DOM depth
  // Normalize any existing nested .wp-block-embed__wrapper > .aspect-video wrappers first
  html = html.replace(
    /<div class="wp-block-embed__wrapper">\s*<div class="aspect-video[^"]*">\s*(<iframe[\s\S]*?<\/iframe>)\s*<\/div>\s*<\/div>/gi,
    '<div class="wp-block-embed__wrapper">$1</div>'
  );

  const formatIframe = (fullIframe: string) => {
    return fullIframe.replace(/<iframe\b([^>]*?)>/i, (m, attrs) => {
      const cleanAttrs = attrs
        .replace(/\s*class="[^"]*"/gi, '')
        .replace(/\s*width="[^"]*"/gi, '')
        .replace(/\s*height="[^"]*"/gi, '');
      return `<iframe${cleanAttrs} class="w-full h-full absolute inset-0 border-0" width="100%" height="100%">`;
    });
  };

  // Reuse existing .wp-block-embed__wrapper and avoid duplicate wrapper bloat
  html = html.replace(
    /<div class="wp-block-embed__wrapper">\s*(<iframe\b[\s\S]*?<\/iframe>)\s*<\/div>/gi,
    (match, iframe) => {
      return `<div class="wp-block-embed__wrapper aspect-video relative w-full my-6 rounded-lg overflow-hidden border border-slate-200 shadow-2xs bg-black">${formatIframe(iframe)}</div>`;
    }
  );

  // Wrap any standalone iframes not already wrapped
  html = html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, (match) => {
    if (match.includes('absolute') || match.includes('aspect-video')) return match;
    return `<div class="aspect-video relative w-full my-6 rounded-lg overflow-hidden border border-slate-200 shadow-2xs bg-black">${formatIframe(match)}</div>`;
  });

  // 8. Clean up duplicate line breaks
  html = html.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');

  // 9. Strip legacy WordPress TOC blocks from rendered HTML to avoid duplicates with universal Astro TOC
  html = html.replace(/<div\b[^>]*class="[^"]*(?:wp-block-rank-math-toc-block|wp-block-uagb-table-of-contents)[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi, '');
  html = html.replace(/<div\b[^>]*class="[^"]*(?:wp-block-rank-math-toc-block|wp-block-uagb-table-of-contents)[^"]*"[\s\S]*?<\/div>/gi, '');
  html = html.replace(/<div\b[^>]*id="ez-toc-container"[^>]*>[\s\S]*?<\/div>/gi, '');

  // 10. Ensure all <h2> and <h3> headings have deterministic IDs for Table of Contents jump navigation
  const headingSlugCounts = new Map<string, number>();
  html = html.replace(/<(h[23])\b([^>]*?)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, content) => {
    // If ID attribute already exists, retain it
    if (/\bid=["']/i.test(attrs)) {
      return match;
    }

    // Generate slug from text content (stripping nested tags)
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (!text) return match;

    let slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug) return match;

    const count = headingSlugCounts.get(slug) || 0;
    headingSlugCounts.set(slug, count + 1);
    if (count > 0) {
      slug = `${slug}-${count + 1}`;
    }

    return `<${tag}${attrs} id="${slug}">${content}</${tag}>`;
  });

  return html.trim();
}

export interface TocHeadingItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Extracts all <h2> and <h3> headings with their IDs from optimized HTML
 */
export function extractTocHeadings(html: string): TocHeadingItem[] {
  if (!html) return [];
  const headings: TocHeadingItem[] = [];
  const regex = /<(h[23])\b([^>]*?)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const content = match[3];
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    // Skip self-referential TOC title
    if (/^table\s*of\s*contents?$/i.test(text)) continue;

    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    if (idMatch && idMatch[1]) {
      headings.push({
        id: idMatch[1],
        text,
        level: tag === 'h2' ? 2 : 3,
      });
    }
  }
  return headings;
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
  const cleanTitle = context.title ? decodeHtmlEntities(stripHtml(context.title)).trim() : '';
  if (!template || typeof template !== 'string') return cleanTitle;

  // Discard empty or punctuation-only templates (e.g. "()", "[]", "-", "—")
  const strippedTest = template.replace(/[\(\)\[\]\-\—\s\|]/g, '').trim();
  if (!strippedTest) {
    return cleanTitle;
  }

  const now = new Date();
  const siteName = context.siteName || 'Top Nepali';
  const sep = context.separator || '—';
  const cleanExcerpt = context.excerpt ? decodeHtmlEntities(stripHtml(context.excerpt)).trim() : '';

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

  // If the string was solely empty placeholders, brackets, or just leftover separators (e.g. "()", "() — Top Nepali", "—", etc.)
  const resolvedWithoutPunctuation = resolved
    .replace(new RegExp(siteName, 'gi'), '')
    .replace(/[\(\)\[\]\-\—\s\|\:\,]/g, '')
    .trim();

  if (!resolvedWithoutPunctuation) {
    return cleanTitle;
  }

  // Deduplicate consecutive identical year tags like "(2026) (2026)"
  resolved = resolved.replace(/\((\d{4})\)\s*\(\1\)/gi, '($1)');

  return resolved;
}

/**
 * Fetch all posts and pages for sitemap generation (paginates until all items are loaded)
 */
export async function getAllPostsForSitemap(): Promise<Array<{ slug: string; lastmod: string }>> {
  const base = getWpBaseUrl();
  const allItems: Array<{ slug: string; lastmod: string }> = [];
  let page = 1;
  const perPage = 100;
  const maxPages = 20; // safety ceiling (up to 2,000 posts)

  while (page <= maxPages) {
    const url = `${base}/wp-json/wp/v2/posts?page=${page}&per_page=${perPage}&status=publish&_fields=slug,date,date_gmt,modified,modified_gmt`;
    try {
      const { data, headers } = await fetchWithCache<any[]>(url, undefined, 43200);
      if (!Array.isArray(data) || data.length === 0) break;

      for (const p of data) {
        if (p.slug) {
          const mod = (p.modified_gmt || p.modified || p.date_gmt || p.date || new Date().toISOString()).split('T')[0];
          allItems.push({ slug: p.slug, lastmod: mod });
        }
      }

      const totalPages = parseInt(headers.get('x-wp-totalpages') || '1', 10);
      if (page >= totalPages) break;
      page++;
    } catch (err) {
      console.warn(`getAllPostsForSitemap page ${page} notice:`, err);
      break;
    }
  }

  // Also fetch published pages (About, Contact, Privacy, etc.)
  try {
    const pagesUrl = `${base}/wp-json/wp/v2/pages?per_page=50&status=publish&_fields=slug,date,date_gmt,modified,modified_gmt`;
    const { data } = await fetchWithCache<any[]>(pagesUrl, undefined, 43200);
    if (Array.isArray(data)) {
      for (const pg of data) {
        if (pg.slug && !allItems.some((i) => i.slug === pg.slug)) {
          const mod = (pg.modified_gmt || pg.modified || pg.date_gmt || pg.date || new Date().toISOString()).split('T')[0];
          allItems.push({ slug: pg.slug, lastmod: mod });
        }
      }
    }
  } catch (pageErr) {
    console.warn('getAllPostsForSitemap pages fetch notice:', pageErr);
  }

  return allItems;
}

/**
 * Query WordPress Rank Math redirection for any slug
 * Sends a HEAD request to the WordPress backend; if Rank Math has an active 301/302 redirect,
 * returns the target URL and status code.
 */
export async function getRankMathRedirection(slug: string): Promise<{ redirect_url: string; redirect_type: number } | null> {
  const cleanSlug = slug.replace(/^\/+|\/+$/g, '');
  if (!cleanSlug) return null;

  const cacheKey = `rm_redirect:${cleanSlug}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const base = getWpBaseUrl();
  try {
    const res = await fetch(`${base}/${encodeURIComponent(cleanSlug)}`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
      headers: {
        'User-Agent': 'TopNepali-Headless-Astro/1.0',
      },
      cf: {
        cacheTtl: 300,
        cacheEverything: true,
      } as any,
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      const redirectBy = res.headers.get('x-redirect-by') || '';

      if (location && redirectBy.toLowerCase().includes('rank math')) {
        const target = location.replace(/^https?:\/\/(?:wp\.)?topnepali\.com/i, '');
        const cleanTarget = (target || location).replace(/^\/+|\/+$/g, '');
        if (cleanTarget !== cleanSlug) {
          const result = {
            redirect_url: target || location,
            redirect_type: res.status,
          };
          cache.set(cacheKey, { data: result, timestamp: now });
          return result;
        }
      }
    }
  } catch (err) {
    // If request timed out or network error, silently fall through
  }

  // Fallback to headless plugin endpoint if available
  try {
    const url = `${base}/wp-json/headless/v1/redirection?slug=${encodeURIComponent(cleanSlug)}`;
    const { data } = await fetchWithCache<{ redirect_url?: string; redirect_type?: number }>(url, 300);
    if (data && data.redirect_url) {
      const cleanTarget = data.redirect_url.replace(/^https?:\/\/(?:wp\.)?topnepali\.com/i, '').replace(/^\/+|\/+$/g, '');
      if (cleanTarget !== cleanSlug) {
        const result = {
          redirect_url: data.redirect_url.replace(/^https?:\/\/(?:wp\.)?topnepali\.com/i, ''),
          redirect_type: data.redirect_type || 301,
        };
        cache.set(cacheKey, { data: result, timestamp: now });
        return result;
      }
    }
  } catch {}

  cache.set(cacheKey, { data: null, timestamp: now });
  return null;
}
