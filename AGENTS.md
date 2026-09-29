# System Architecture & AI Coding Guidelines (AGENTS.md)

> **NOTICE FOR AI ASSISTANTS & DEVELOPERS:**  
> This file is the single source of truth for the **TopNepali Headless WordPress + Astro SSR** platform. Read this document thoroughly before inspecting, editing, or deploying code across machines.

---

## 1. System & Architecture Overview

- **Frontend Application:** Astro SSR running in Advanced Mode on **Cloudflare Pages / Workers**.
  - Public Domain: `https://topnepali.com`
  - GitHub Repository: `iamgrisma/topnepali` (Branch: `main`)
- **Backend CMS:** WordPress on LiteSpeed Enterprise Server.
  - Backend Domain: `https://wp.topnepali.com`
  - Custom Plugin: `topnepali-headless` (`wp-plugin/headless/headless.php`, v1.4.0)
- **Media & Object Storage:** Cloudflare R2 bucket.
  - Media Domain: `https://objects.topnepali.com`
- **Global Edge CDN:** Cloudflare Global Edge with Tiered Caching (330+ POPs worldwide).
- **AI WordPress Connector:** Easy MCP AI via OAuth 2.0 device code flow (`https://wp.topnepali.com/wp-json/easy-mcp-ai/v1/mcp`).

---

## 2. Actual Current Situation & Operational State

| Component | Status | Details |
|---|---|---|
| **Git Working Tree** | Clean (`main`) | Up to date with `origin/main`. Clean commit history. |
| **`.env` File** | **Untracked** | Strictly ignored in `.gitignore`. Excluded from git history to avoid secret push blocks. |
| **Edge CDN Caching** | Active (7 Days) | `Cloudflare-CDN-Cache-Control: max-age=604800, stale-while-revalidate=86400` in `src/middleware.ts`. |
| **Browser Caching** | Revalidate (0s) | `Cache-Control: public, max-age=0, must-revalidate` (browser always contacts edge; instant update upon purge). |
| **On-Demand Webhook** | Operational | `/api/revalidate` accepts POST from WordPress plugin, purges Astro memory, and triggers Cloudflare Zone API purge. |
| **Zone Purge Binding** | Configured | `CF_ZONE_ID = "e3ddc9ce395e8c2c38a9d14e002c8d57"` in `wrangler.toml` [vars]. `CF_API_TOKEN` configured in dashboard. |
| **WordPress Plugin** | v1.4.0 Active | `topnepali-headless` handles on-save revalidation, Rank Math metadata rewrite, and admin bar purge actions. |
| **Post Data Fact-Check**| Verified | Post ID `5132` (`metropolitan-cities-in-nepal`): Kathmandu = `Sunita Dangol (Acting Mayor)`, Lalitpur = `Chiribabu Maharjan`. |

---

## 3. Caching & Invalidation Architecture (How It Works)

### A. The Caching Goal: Sub-15ms TTFB Everywhere
1. Incoming visitor GET requests are absorbed directly by Cloudflare's Global Edge CDN proxy without invoking Astro SSR or WordPress.
2. Static assets (`/_astro/*`, CSS, JS, fonts) are cached immutably for 1 year (`max-age=31536000, immutable`).
3. Dynamic SSR HTML pages are cached on Cloudflare Edge CDN for 7 days with 1-day `stale-while-revalidate`.

### B. The On-Demand Invalidation Pipeline:
When an editor or AI writing agent modifies a post or page in WordPress:
```
[WordPress post edit / trash]
       │
       ▼ (hook: on_save_post / wp_trash_post)
[topnepali-headless plugin]
       │
       ▼ (asynchronous non-blocking HTTP POST)
[Astro: /api/revalidate?secret=...]
       ├─► 1. clearWpCache(slug) — Clears internal SSR memory cache
       ├─► 2. Cloudflare Zone Purge API (POST to api.cloudflare.com/client/v4/zones/:zone/purge_cache)
       │       Purges target URLs across all 330+ Cloudflare Edge POPs in ~100ms
       └─► 3. Proactive Cache Warming (background GET requests)
               Pre-warms fresh HTML so the next visitor receives an instant edge cache HIT
```

### C. Why Cloudflare Zone API Purge is Required:
In Cloudflare Workers / Pages architecture:
- `caches.default.delete()` ONLY clears the local Worker CacheStorage within the single data center handling the webhook.
- It **does not** purge Cloudflare's outer HTTP Edge CDN Proxy (`Cloudflare-CDN-Cache-Control`).
- The **only way** to invalidate the global CDN proxy cache across all 330+ worldwide data centers is via the **Cloudflare Zone Purge API** using `CF_ZONE_ID` and `CF_API_TOKEN`.

---

## 4. Environment Variables & Credentials Policy

### A. Zero Secret In Git Policy (CRITICAL)
- **NEVER** add, hardcode, or commit sensitive secret tokens or private keys to `wrangler.toml`, `astro.config.mjs`, or any git-tracked file.
- **Specific forbidden variables in git:**
  - `REVALIDATE_SECRET`
  - `CF_API_TOKEN` / `CLOUDFLARE_API_TOKEN`
  - Any private database credentials, application passwords, or user API tokens.
- **Reason:** Hardcoding variables into `wrangler.toml` leaks them into version control and GitHub Push Protection blocks the push.

### B. Where Variables Belong:
1. **Public Configuration (`wrangler.toml` [vars]):**
   ```toml
   [vars]
   URL = "https://topnepali.com"
   WORDPRESS_URL = "https://wp.topnepali.com"
   PUBLIC_GA_ID = "G-K2R0GSQE0M"
   PUBLIC_GTM_ID = "GTM-MD2NWFJ"
   PUBLIC_ADSENSE_ID = "ca-pub-5410507143596599"
   CF_ZONE_ID = "e3ddc9ce395e8c2c38a9d14e002c8d57"
   ```
   *(Note: `CF_ZONE_ID` is a non-secret public zone identifier; keeping it in `wrangler.toml` [vars] prevents it from being wiped on redeployments).*

2. **Production Encrypted Secrets (Cloudflare Pages Dashboard):**
   - Path: `Cloudflare Pages -> topnepali -> Settings -> Environment Variables`
   - `REVALIDATE_SECRET`: Secret token for validating webhooks from WordPress.
   - `CF_API_TOKEN`: Cloudflare API Token with `Zone - Cache Purge - Purge` permissions for `topnepali.com`.

3. **Local Development Secrets (`.env`):**
   - Strictly maintained in `.gitignore`. Never track or commit.

---

## 5. WordPress Plugin (`topnepali-headless`)

- **Code Path:** `wp-plugin/headless/headless.php` (Version `1.4.0`)
- **Plugin Distribution Endpoint:** Hosted at `https://topnepali.com/api/headless-plugin`
- **Automatic Updates:**
  - Native WordPress Core upgrader integration (`pre_set_site_transient_update_plugins`).
  - Transient cache TTL: 1 hour (`HOUR_IN_SECONDS`) to prevent hammering the frontend.
  - Manual bypass: "Check for Plugin Updates Now" button in `Options -> Headless Setup` forces an immediate remote check.
  - Auto-update: When "Automatic Background Updates" is checked, WordPress core updates the plugin automatically via WP-Cron.
- **Cache Management UI in WP Admin:**
  - Single Post Purge button on Admin Bar.
  - Purge Entire Frontend Cache button.
  - Pre-Warm Top 20 Posts & Archives button.

---

## 6. Easy MCP AI (WordPress Connection for AI Assistants)

- **Endpoint:** `https://wp.topnepali.com/wp-json/easy-mcp-ai/v1/mcp`
- **Bridge Script:** `scripts/mcp-bridge.mjs` (Translates stdio MCP protocol to HTTP with automated OAuth token refresh).
- **Token Cache:** `scripts/.mcp-token.json` (Ignored in `.gitignore`).
- **Tools Available:** 117 native tools (`wp_list_posts`, `wp_get_post`, `wp_update_post`, `wp_list_plugins`, `wp_history_list`, etc.).
- **When switching machines:**
  - If `.mcp-token.json` is missing on the new machine, run `node scripts/mcp-bridge.mjs` to authorize via device code flow.

---

## 7. Strict Technical Rules for Future AI Coding Sessions

1. **Astro CSRF Check Origin:**
   - Keep `security.checkOrigin: false` in `astro.config.mjs`. Server-to-server POST webhooks from WordPress do not carry standard browser `Origin` headers. Enabling `checkOrigin` causes `HTTP 403 Forbidden`.
2. **Cloudflare Worker Runtime Variables:**
   - In Astro v6+, do not rely exclusively on `Astro.locals.runtime.env` (deprecated).
   - Use dynamic import:
     ```ts
     const cf = await import('cloudflare:workers');
     const env = cf.env || (context.locals as any)?.runtime?.env || {};
     ```
3. **Never reduce Edge CDN TTL to short intervals (e.g. 60s):**
   - The user's explicit objective is a high-performance headless architecture where Cloudflare Edge CDN caches dynamic pages for 7 days (`max-age=604800`) and the webhook purges on-demand.
4. **Build & Validation Command:**
   - Always validate changes with `npm run build` before pushing to `origin main`.
