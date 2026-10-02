import { getPosts, getSiteInfo, getPostTitle, getPostFeaturedImage, getPostCategories, getPostAuthor, stripHtml } from './wp';
import { SITE_URL } from '../config';

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getMimeType(url: string): string {
  const clean = (url || '').toLowerCase().split('?')[0];
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Universal RSS Feed Generator for Top Nepali
 * Provides full compatibility with Pinterest auto-publishers, Feedly, and RSS readers.
 */
export async function generateRssFeed(feedPath: string = 'rss.xml'): Promise<Response> {
  const siteUrl = SITE_URL.replace(/\/+$/, '');
  const siteInfo = getSiteInfo();

  // Fetch the latest 30 published articles
  const postsResult = await getPosts({
    perPage: 30,
    page: 1,
    fields: 'id,date,date_gmt,modified,slug,status,type,link,title,excerpt,content,featured_media,categories,tags,_links,_embedded',
  });

  const items = postsResult.data.map((post) => {
    const postUrl = `${siteUrl}/${post.slug}`;
    const pubDate = new Date(post.date_gmt || post.date).toUTCString();
    const rawTitle = getPostTitle(post) || 'Untitled';
    const title = escapeXml(rawTitle);
    const author = getPostAuthor(post);
    const authorName = escapeXml(author.name || 'Top Nepali Editorial');
    const categories = getPostCategories(post);
    const featuredImage = getPostFeaturedImage(post);

    const rawExcerpt = stripHtml(post.excerpt?.rendered || post.content?.rendered || '').slice(0, 400);
    const cleanExcerpt = escapeXml(rawExcerpt);

    // Categorization
    const categoryTags = categories
      .map((cat) => `      <category><![CDATA[${cat.name}]]></category>`)
      .join('\n');

    // Media & Enclosures for Pinterest and RSS reader auto-pinning
    let mediaTags = '';
    let descriptionContent = cleanExcerpt;

    if (featuredImage?.url) {
      const imgUrl = featuredImage.url;
      const mime = getMimeType(imgUrl);
      const imgAlt = escapeXml(featuredImage.alt || rawTitle);

      mediaTags = `      <enclosure url="${imgUrl}" length="50000" type="${mime}" />
      <media:content url="${imgUrl}" medium="image" type="${mime}">
        <media:title><![CDATA[${rawTitle}]]></media:title>
      </media:content>
      <media:thumbnail url="${imgUrl}" />`;

      // Embedding the image inside the description facilitates automatic Pinterest card creation
      descriptionContent = `&lt;img src=&quot;${imgUrl}&quot; alt=&quot;${imgAlt}&quot; /&gt;&lt;p&gt;${cleanExcerpt}&lt;/p&gt;`;
    }

    return `    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[${authorName}]]></dc:creator>
${categoryTags ? categoryTags + '\n' : ''}${mediaTags ? mediaTags + '\n' : ''}      <description>${descriptionContent}</description>
    </item>`;
  }).join('\n');

  const cleanFeedPath = feedPath.replace(/^\/+/, '');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
  xmlns:slash="http://purl.org/rss/1.0/modules/slash/"
  xmlns:media="http://search.yahoo.com/mrss/"
>
  <channel>
    <title>${escapeXml(siteInfo.name || 'Top Nepali')}</title>
    <atom:link href="${siteUrl}/${cleanFeedPath}" rel="self" type="application/rss+xml"/>
    <link>${siteUrl}</link>
    <description>${escapeXml(siteInfo.description || 'Covering Top Nepali News, Updates, Educational Information, and Digital Guides')}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <language>en</language>
    <sy:updatePeriod>hourly</sy:updatePeriod>
    <sy:updateFrequency>1</sy:updateFrequency>
    <image>
      <url>https://objects.topnepali.com/wp-content/uploads/2026/09/Top-Nepali-Logo.png</url>
      <title>${escapeXml(siteInfo.name || 'Top Nepali')}</title>
      <link>${siteUrl}</link>
      <width>144</width>
      <height>144</height>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=43200',
      'Cloudflare-CDN-Cache-Control': 'max-age=3600, stale-while-revalidate=43200',
    },
  });
}
