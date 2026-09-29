export interface WPRendered {
  rendered: string;
  protected?: boolean;
}

export interface WPMediaSize {
  file: string;
  width: number;
  height: number;
  mime_type?: string;
  source_url: string;
}

export interface WPMediaDetails {
  width?: number;
  height?: number;
  file?: string;
  sizes?: Record<string, WPMediaSize>;
}

export interface WPMedia {
  id: number;
  source_url: string;
  alt_text?: string;
  title?: WPRendered;
  media_details?: WPMediaDetails;
}

export interface WPAuthor {
  id: number;
  name: string;
  url?: string;
  description?: string;
  link?: string;
  slug?: string;
  avatar_urls?: Record<string, string>;
}

export interface WPTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
  link?: string;
}

export interface WPEmbedded {
  author?: WPAuthor[];
  'wp:featuredmedia'?: WPMedia[];
  'wp:term'?: WPTerm[][];
}

export interface WPSEO {
  title?: string | null;
  description?: string | null;
  canonical_url?: string | null;
  focus_keyword?: string | null;
  robots?: string | string[] | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  twitter_title?: string | null;
  twitter_desc?: string | null;
  twitter_image?: string | null;
}

export interface WPPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: WPRendered;
  content: WPRendered;
  excerpt: WPRendered;
  author: number;
  featured_media: number;
  comment_status?: string;
  categories: number[];
  tags: number[];
  _embedded?: WPEmbedded;
  head?: string | null;
  seo?: WPSEO;
}

export interface WPPage {
  id: number;
  date: string;
  modified: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: WPRendered;
  content: WPRendered;
  excerpt?: WPRendered;
  featured_media?: number;
  _embedded?: WPEmbedded;
  head?: string | null;
  seo?: WPSEO;
}

export interface WPCategory {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  taxonomy: string;
  parent: number;
}

export interface WPTag {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  taxonomy: string;
}

export interface WPSiteInfo {
  name: string;
  description: string;
  url: string;
  home?: string;
  gmt_offset?: number;
  timezone_string?: string;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  totalPages: number;
  currentPage: number;
}
