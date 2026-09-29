# Guidelines for AI Coding Assistants (AGENTS.md)

## 1. Zero Secret In Git Policy (CRITICAL)
- **NEVER** add, hardcode, or commit sensitive secrets, tokens, or credentials to `wrangler.toml`, `astro.config.mjs`, or any git-tracked configuration file.
- **Specific forbidden variables in `wrangler.toml` [vars]:**
  - `REVALIDATE_SECRET`
  - `CF_API_TOKEN` / `CLOUDFLARE_API_TOKEN`
  - `CF_ZONE_ID` / `CLOUDFLARE_ZONE_ID`
  - Any private database credentials, application passwords, or API keys.
- **Reason:** Hardcoding variables into `wrangler.toml` not only leaks them into public version control, but also overrides and wipes the production secrets configured in the Cloudflare Pages Dashboard upon deployment.
- **Where secrets belong:**
  - Production secrets: Cloudflare Pages Dashboard &rarr; Settings &rarr; Environment Variables.
  - Local secrets: `.env` file (strictly kept in `.gitignore`).

## 2. Headless Architecture & Webhook Policy
- The frontend is hosted on Cloudflare Pages (Astro SSR).
- The backend WordPress instance is hosted at `https://wp.topnepali.com`.
- Webhooks from WordPress to `/api/revalidate` are server-to-server HTTP POST requests. Do not re-enable `security.checkOrigin: true` in `astro.config.mjs` as it blocks server-to-server webhooks with HTTP 403 Forbidden.
- Always use runtime environment resolution (`context.locals.runtime.env`) for secrets in Astro endpoints rather than static build-time constants.
