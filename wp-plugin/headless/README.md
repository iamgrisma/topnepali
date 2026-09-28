# TopNepali Headless — WordPress Plugin

This WordPress plugin connects your WordPress CMS backend to your Astro / Cloudflare Edge frontend.

## Features

1. **Automatic On-Demand Cache Invalidation**:
   - Fires non-blocking asynchronous webhooks (`POST /api/revalidate`) on `save_post`, `edit_post`, and `wp_trash_post`.
   - Never slows down saving or publishing in the WordPress editor.
2. **Preview & Permalink Rewrites**:
   - Rewrites "View Post" and preview buttons in WordPress Admin to open the Astro frontend directly.
3. **REST API Security**:
   - Shields `/wp/v2/users` endpoint from unauthenticated user enumeration.
4. **Admin Dashboard Controls**:
   - Configure Frontend URL and Secret Token.
   - Built-in "Test Connection" button with live status feedback.

## Installation

### Method A: Direct Upload to Server
1. Copy the `headless` directory into your WordPress plugins directory:
   ```
   wp-content/plugins/headless/
   └── headless.php
   ```
2. In WordPress Admin, navigate to **Plugins &rarr; Installed Plugins**.
3. Click **Activate** under **TopNepali Headless**.
4. Go to **Settings &rarr; Headless Setup** to configure the Frontend URL and Secret Token.

### Method B: Via Zip
1. Zip the `headless/` directory into `headless.zip`.
2. In WordPress Admin, go to **Plugins &rarr; Add New &rarr; Upload Plugin**.
3. Upload `headless.zip` and click **Activate**.
