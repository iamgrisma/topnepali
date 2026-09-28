# TopNepali Headless WordPress (Astro SSR)

A high-performance, dynamic headless WordPress platform built on the **Astro framework** with **Server-Side Rendering (SSR)**.

## Highlights

- **Dynamic On-Demand SSR**: Posts, categories, tags, and pages are fetched live from the WordPress REST API without requiring full static site rebuilds when new content is published.
- **Fast In-Memory Cache**: Built-in 60-second SWR cache prevents unnecessary API thrashing while guaranteeing fresh updates.
- **Pure Semantic DOM**: Ultra-shallow DOM hierarchy, zero unnecessary container wrappers, and 100% responsive GeneratePress-compatible styling.
- **Strictly No Emojis**: Crisp inline SVGs and Lucide icons across all navigation, cards, and modal components.
- **TopNepali Network 9-Dot Launcher**: Seamlessly integrated with sibling edge apps (`typing`, `fonts`, `share`, `election`, `constitution`).
- **Flexible Deployment**: Supports Cloudflare Pages/Workers (`@astrojs/cloudflare`) and Node.js standalone server (`@astrojs/node`).
- **Zero HTTP Redirections**: Canonical source URL resolution in-memory with clean 404 responses for missing content.

## Architecture

```
topnepali/
├── astro.config.mjs          # SSR configuration (Cloudflare / Node hybrid)
├── package.json              # Astro 7+, Tailwind CSS v4, TypeScript
├── scripts/
│   └── astro-cli.js          # Cross-environment Termux / Android CLI runner
├── src/
│   ├── components/
│   │   ├── Header.astro      # Site branding, desktop dropdowns, mobile drawer
│   │   ├── Footer.astro      # 4-column unified TopNepali network footer
│   │   ├── PostCard.astro    # Blog stream card with media, author, date & reading time
│   │   ├── Sidebar.astro     # Search form, categories with count pills, recent posts
│   │   ├── Pagination.astro  # Clean non-redirect pagination
│   │   ├── SearchModal.astro # Instant search overlay dialog
│   │   └── TopNepaliNetwork.astro # 9-dot launcher for topnepali edge apps
│   ├── layouts/
│   │   └── BaseLayout.astro  # HTML shell, Open Graph meta, typography styling
│   ├── lib/
│   │   └── wp.ts             # Generic WordPress REST API client & helpers
│   ├── types/
│   │   └── wp.ts             # TypeScript definitions for WordPress API data
│   └── pages/
│       ├── index.astro       # Dynamic homepage (featured post + recent articles)
│       ├── [...slug].astro   # Universal dynamic single post & page reader
│       ├── category/[slug].astro # Dynamic category archive
│       ├── tag/[slug].astro  # Dynamic tag archive
│       ├── search.astro      # Dynamic live search results
│       ├── 404.astro         # In-memory 404 handler
│       └── api/posts.ts      # Headless JSON API endpoint
└── .env                      # WordPress REST API URL and configuration
```

## Configuration

Edit `.env` to point to any WordPress blog:

```bash
WORDPRESS_URL=https://topnepali.com
SITE_NAME="Top Nepali"
SITE_DESCRIPTION="Covering Top Nepali News, Updates, Educational Information"
SITE_URL=https://topnepali.com
POSTS_PER_PAGE=10
```

## Running Locally

```bash
# Start development server
npm run dev

# Build for Cloudflare
npm run build:cf

# Build for Node.js
npm run build:node

# Preview build
npm run preview
```
