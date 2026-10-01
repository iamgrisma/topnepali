<?php
/**
 * Plugin Name: TopNepali Headless Engine
 * Plugin URI: https://topnepali.com
 * Description: Enterprise Headless WordPress engine for Astro SSR & Cloudflare Edge. Provides automatic granular cache invalidation, admin bar purge controls, native WordPress core zip updates, Rank Math SEO bridge, and subdomain protection.
 * Version: 1.5.6
 * Author: Top Nepali
 * Author URI: https://topnepali.com
 * License: GPL-2.0+
 * Text Domain: topnepali-headless
 * Update URI: https://topnepali.com/api/headless-plugin
 */

if (!defined('ABSPATH')) {
    exit;
}

class TopNepali_Headless_Plugin {
    const VERSION = '1.5.6';

    const OPTION_FRONTEND_URL = 'topnepali_headless_frontend_url';
    const OPTION_SECRET = 'topnepali_headless_secret';
    const OPTION_REWRITE_LINKS = 'topnepali_headless_rewrite_links';
    const OPTION_AUTO_UPDATE = 'topnepali_headless_auto_update';

    private $cached_frontend_url = null;
    private $cached_secret = null;

    public function __construct() {
        // Content Lifecycle Hooks: Granular automatic cache purging
        add_action('save_post', array($this, 'on_save_post'), 10, 3);
        add_action('wp_trash_post', array($this, 'on_trash_post'));
        add_action('untrash_post', array($this, 'on_trash_post'));

        // Taxonomy Lifecycle Hooks: Purge category & tag archives when modified
        add_action('create_category', array($this, 'on_taxonomy_change'));
        add_action('edited_category', array($this, 'on_taxonomy_change'));
        add_action('delete_category', array($this, 'on_taxonomy_change'));
        add_action('create_post_tag', array($this, 'on_taxonomy_change'));
        add_action('edited_post_tag', array($this, 'on_taxonomy_change'));
        add_action('delete_post_tag', array($this, 'on_taxonomy_change'));

        // Navigation Menu & Site Branding updates
        add_action('wp_update_nav_menu', array($this, 'on_menu_change'));
        add_action('update_option_blogname', array($this, 'on_site_info_change'));
        add_action('update_option_blogdescription', array($this, 'on_site_info_change'));

        // Native WordPress Core Plugin Update Pipeline (Registered globally so background cron auto-updates also fire)
        add_filter('pre_set_site_transient_update_plugins', array($this, 'check_for_update'));
        add_filter('site_transient_update_plugins', array($this, 'check_for_update'));
        add_filter('plugins_api', array($this, 'plugin_popup_info'), 20, 3);
        add_filter('auto_update_plugin', array($this, 'filter_auto_update_plugin'), 10, 2);
        add_filter('update_plugins_topnepali.com', array($this, 'filter_update_plugins_host'), 10, 4);

        // Admin & Dashboard controls
        if (is_admin()) {
            add_action('admin_menu', array($this, 'register_admin_menu'));
            add_action('admin_init', array($this, 'register_settings'));
            add_action('admin_init', array($this, 'handle_admin_cache_actions'));
            add_filter('plugin_auto_update_setting_html', array($this, 'filter_plugin_auto_update_html'), 10, 3);
        }

        // Admin Bar Quick Purge Buttons
        add_action('admin_bar_menu', array($this, 'register_admin_bar_menu'), 99);
        add_action('admin_init', array($this, 'handle_admin_bar_purge'));

        // Preview & Permalink rewrites
        add_filter('post_link', array($this, 'filter_permalink'), 10, 2);
        add_filter('page_link', array($this, 'filter_permalink'), 10, 2);
        add_filter('preview_post_link', array($this, 'filter_preview_link'), 10, 2);

        // Subdomain & Backend Security Protection:
        // - Prevent duplicate content cannibalization by 301-redirecting public visits to frontend
        // - Shield wp.topnepali.com from indexing via X-Robots-Tag
        // - Block ?author=N user scanning
        add_action('template_redirect', array($this, 'handle_frontend_redirect'), 1);
        add_action('send_headers', array($this, 'send_backend_security_headers'));

        // Rank Math URL Sanitizers (guarantee canonical & OG tags point strictly to production frontend)
        add_filter('rank_math/frontend/canonical', array($this, 'filter_rank_math_url'));
        add_filter('rank_math/opengraph/url', array($this, 'filter_rank_math_url'));
        add_filter('rank_math/json_ld', array($this, 'filter_rank_math_json_ld'), 99, 1);
        add_filter('rank_math/sitemap/url', array($this, 'filter_rank_math_sitemap_url'), 99, 2);
        add_filter('rank_math/sitemap/entry', array($this, 'filter_rank_math_sitemap_entry'), 99, 3);
        add_filter('rank_math/sitemap/xml_text', array($this, 'filter_rank_math_sitemap_xml_text'), 99, 1);

        // REST API enhancements & Edge Caching
        add_action('rest_api_init', array($this, 'configure_rest_api'));
        add_filter('rest_post_dispatch', array($this, 'filter_rest_cache_headers'), 10, 3);
        add_filter('rest_post_query', array($this, 'filter_rest_category_children'), 10, 2);

        // Dynamic Rank Math Tool Redirection Sync
        add_action('init', array($this, 'sync_default_tool_redirections'));

        // Extend Easy MCP AI OAuth authentication to all REST endpoints (not just /easy-mcp-ai/)
        add_filter('determine_current_user', array($this, 'authenticate_mcp_oauth_token'), 90);
    }

    /**
     * Add public edge cache headers to unauthenticated REST API responses
     * Allows Cloudflare and LiteSpeed to cache WP REST responses, reducing API latency from 1900ms to 20ms
     */
    public function filter_rest_cache_headers($response, $server, $request) {
        if (!is_a($response, 'WP_REST_Response')) {
            return $response;
        }

        // Only cache public GET requests (never cache authenticated, POST, PUT, or DELETE)
        if ($request->get_method() !== 'GET' || is_user_logged_in()) {
            return $response;
        }

        $route = $request->get_route();
        // Target posts, pages, categories, tags, and media queries
        if (preg_match('#^/wp/v2/(posts|pages|categories|tags|media)#', $route)) {
            // Edge cache REST responses for 60s with stale-while-revalidate so updates reflect promptly
            $response->header('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
            $response->header('Cloudflare-CDN-Cache-Control', 'max-age=120, stale-while-revalidate=300');
            $response->header('X-Headless-Edge-Cache', 'ENABLED');
        }

        return $response;
    }

    /**
     * Include child category posts in WordPress REST API queries, matching core WP_Query theme behavior
     */
    public function filter_rest_category_children($args, $request) {
        if (!empty($args['tax_query']) && is_array($args['tax_query'])) {
            foreach ($args['tax_query'] as $key => $clause) {
                if (is_array($clause) && isset($clause['taxonomy']) && $clause['taxonomy'] === 'category') {
                    $args['tax_query'][$key]['include_children'] = true;
                }
            }
        }
        return $args;
    }

    /**
     * Get configured frontend URL with in-memory memoization
     */
    public function get_frontend_url() {
        if ($this->cached_frontend_url === null) {
            $url = get_option(self::OPTION_FRONTEND_URL, 'https://topnepali.com');
            $this->cached_frontend_url = rtrim(trim($url), '/');
        }
        return $this->cached_frontend_url;
    }

    /**
     * Get configured secret token with in-memory memoization
     */
    public function get_secret() {
        if ($this->cached_secret === null) {
            $this->cached_secret = (string) get_option(self::OPTION_SECRET, 'topnepali_revalidate_secure_token');
        }
        return $this->cached_secret;
    }

    /**
     * Authenticate Easy MCP AI OAuth tokens for all REST endpoints.
     * Easy MCP AI only authenticates tokens on its own /easy-mcp-ai/ namespace.
     * This extends that authentication globally so headless endpoints can use the same tokens.
     */
    public function authenticate_mcp_oauth_token($user_id) {
        // Skip if already authenticated
        if ($user_id) {
            return $user_id;
        }

        // Only process on REST API requests
        if (!defined('REST_REQUEST') || !REST_REQUEST) {
            return $user_id;
        }

        $auth_header = '';
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('getallheaders')) {
            $headers = getallheaders();
            $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : '';
        }

        if (empty($auth_header) || stripos($auth_header, 'Bearer wpmcp_') !== 0) {
            return $user_id;
        }

        $token = trim(substr($auth_header, 7));

        // Try Easy MCP AI's own validation if available
        if (class_exists('\\EasyMcpAi\\Auth\\TokenValidator')) {
            try {
                $validator = new \EasyMcpAi\Auth\TokenValidator();
                $validated_user = $validator->validate($token);
                if ($validated_user) {
                    return $validated_user;
                }
            } catch (\Exception $e) {}
        }

        // Fallback: Look up token in wp_options where Easy MCP AI stores OAuth tokens
        $option_key = 'easy_mcp_ai_oauth_tokens';
        $tokens = get_option($option_key, array());
        if (is_array($tokens)) {
            foreach ($tokens as $stored) {
                if (isset($stored['access_token_hash'], $stored['user_id'])) {
                    if (hash_equals($stored['access_token_hash'], hash('sha256', $token))) {
                        $expires = isset($stored['expires_at']) ? $stored['expires_at'] : 0;
                        if ($expires > time()) {
                            return (int) $stored['user_id'];
                        }
                    }
                }
            }
        }

        // Fallback 2: Check if Easy MCP AI uses a custom DB table
        global $wpdb;
        $table = $wpdb->prefix . 'easy_mcp_ai_tokens';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $token_hash = hash('sha256', $token);
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT user_id FROM {$table} WHERE token_hash = %s AND expires_at > %s LIMIT 1",
                $token_hash, current_time('mysql', true)
            ));
            if ($row) {
                return (int) $row->user_id;
            }
        }

        return $user_id;
    }

    /**
     * Trigger non-blocking revalidation request to Astro Cloudflare worker and warm edge cache
     */
    public function dispatch_revalidation($slug = null, $type = 'post', $action = 'update', $extra_urls = array()) {
        $frontend_url = $this->get_frontend_url();
        $secret = $this->get_secret();

        if (empty($frontend_url) || empty($secret)) {
            return false;
        }

        $endpoint = $frontend_url . '/api/revalidate?secret=' . rawurlencode($secret);

        $payload = array(
            'slug'   => $slug,
            'type'   => $type,
            'action' => $action,
            'urls'   => $extra_urls,
            'time'   => current_time('mysql'),
            'warm'   => true, // Requests Astro worker to pre-warm immediately
        );

        // Fire-and-forget non-blocking HTTP request (does not block editor)
        wp_remote_post($endpoint, array(
            'method'      => 'POST',
            'timeout'     => 5,
            'blocking'    => false, // Asynchronous
            'sslverify'   => true,
            'headers'     => array(
                'Content-Type'        => 'application/json',
                'Origin'              => $frontend_url,
                'Referer'             => $frontend_url,
                'x-revalidate-secret' => $secret,
            ),
            'body'        => wp_json_encode($payload),
            'data_format' => 'body',
        ));

        // Purge LiteSpeed Cache if plugin is active on WP
        if (defined('LSCWP_V')) {
            do_action('litespeed_purge_all');
        }

        return true;
    }

    /**
     * Proactively warm URLs on Cloudflare Edge CDN using non-blocking asynchronous GET requests
     */
    public function warm_cache($urls = array()) {
        if (empty($urls)) return 0;

        $frontend_url = $this->get_frontend_url();
        $target_urls = array();

        foreach ($urls as $u) {
            $full_url = (strpos($u, 'http') === 0) ? $u : $frontend_url . '/' . ltrim($u, '/');
            if (!in_array($full_url, $target_urls)) {
                $target_urls[] = $full_url;
            }
        }

        $dispatched = 0;
        foreach ($target_urls as $url) {
            wp_remote_get($url, array(
                'timeout'     => 5,
                'blocking'    => false, // Non-blocking: background warmup without freezing WP admin
                'sslverify'   => true,
                'headers'     => array(
                    'User-Agent' => 'TopNepali-WP-Cache-Warmer/1.0',
                    'Accept'     => 'text/html,application/xhtml+xml',
                ),
            ));
            $dispatched++;
        }

        return $dispatched;
    }

    /**
     * Hook: On Post / Page Save & Publish (Granular Purging)
     */
    public function on_save_post($post_id, $post, $update) {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (wp_is_post_revision($post_id)) return;

        // Invalidate cached Rank Math head so changes take effect immediately
        delete_post_meta($post_id, '_headless_rm_head');

        if ($post->post_status !== 'publish') return;
        if (!in_array($post->post_type, array('post', 'page'))) return;

        $extra_urls = array();
        if ($post->post_type === 'post') {
            // Category archives (including parent categories)
            $categories = get_the_category($post_id);
            if (!empty($categories) && !is_wp_error($categories)) {
                foreach ($categories as $cat) {
                    $extra_urls[] = '/category/' . $cat->slug;
                    if ($cat->parent) {
                        $parent = get_category($cat->parent);
                        if ($parent && !is_wp_error($parent)) {
                            $extra_urls[] = '/category/' . $parent->slug;
                        }
                    }
                }
            }
            // Tag archives
            $tags = get_the_tags($post_id);
            if (!empty($tags) && !is_wp_error($tags)) {
                foreach ($tags as $tag) {
                    $extra_urls[] = '/tag/' . $tag->slug;
                }
            }
        }

        $this->dispatch_revalidation($post->post_name, $post->post_type, $update ? 'update' : 'publish', array_unique($extra_urls));
    }

    /**
     * Hook: On Trash / Delete Post
     */
    public function on_trash_post($post_id) {
        delete_post_meta($post_id, '_headless_rm_head');

        $post = get_post($post_id);
        if (!$post) return;

        $extra_urls = array();
        if ($post->post_type === 'post') {
            $categories = get_the_category($post_id);
            if (!empty($categories) && !is_wp_error($categories)) {
                foreach ($categories as $cat) {
                    $extra_urls[] = '/category/' . $cat->slug;
                }
            }
            $tags = get_the_tags($post_id);
            if (!empty($tags) && !is_wp_error($tags)) {
                foreach ($tags as $tag) {
                    $extra_urls[] = '/tag/' . $tag->slug;
                }
            }
        }

        $this->dispatch_revalidation($post->post_name, $post->post_type, 'delete', array_unique($extra_urls));
    }

    /**
     * Hook: On Taxonomy (Category/Tag) Create, Edit, or Delete
     */
    public function on_taxonomy_change($term_id) {
        $term = get_term($term_id);
        if (!$term || is_wp_error($term)) return;

        $path = ($term->taxonomy === 'category') ? '/category/' . $term->slug : '/tag/' . $term->slug;
        $this->dispatch_revalidation(null, 'taxonomy', 'update', array($path, '/blogs', '/sitemap.xml'));
    }

    /**
     * Hook: On Navigation Menu Change
     */
    public function on_menu_change($menu_id) {
        $this->dispatch_revalidation(null, 'menu', 'update', array('/', '/blogs', '/rss.xml'));
    }

    /**
     * Hook: On Site Info / Branding Change
     */
    public function on_site_info_change() {
        $this->dispatch_revalidation(null, 'site_info', 'update', array('/', '/blogs', '/rss.xml', '/sitemap.xml'));
    }

    /**
     * Filter permalinks so "View Post" links point directly to Headless frontend
     */
    public function filter_permalink($permalink, $post) {
        if (!get_option(self::OPTION_REWRITE_LINKS, '1')) {
            return $permalink;
        }
        $post = get_post($post);
        if (!$post || !in_array($post->post_type, array('post', 'page'))) {
            return $permalink;
        }
        $frontend_url = $this->get_frontend_url();
        return $frontend_url . '/' . ltrim($post->post_name, '/');
    }

    public function filter_preview_link($preview_link, $post) {
        if (!get_option(self::OPTION_REWRITE_LINKS, '1')) {
            return $preview_link;
        }
        $frontend_url = $this->get_frontend_url();
        return $frontend_url . '/' . ltrim($post->post_name, '/');
    }

    /**
     * REST API Enhancements:
     * - Expose Rank Math rendered head & structured SEO metadata
     * - Block unauthenticated user enumeration
     */
    public function configure_rest_api() {
        // Enable Rank Math native REST API post meta and headless support
        add_filter('rank_math/rest/enable_post_meta', '__return_true');
        add_filter('rank_math/frontend/headless', '__return_true');

        // Expose Rank Math fully-rendered head HTML in /wp/v2/posts and /wp/v2/pages
        register_rest_field(array('post', 'page'), 'head', array(
            'get_callback' => array($this, 'get_rank_math_head'),
            'schema'       => array(
                'description' => 'Rank Math rendered HTML head tags and JSON-LD schema',
                'type'        => 'string',
            ),
        ));

        // Expose Rank Math structured SEO fields in /wp/v2/posts and /wp/v2/pages
        register_rest_field(array('post', 'page'), 'seo', array(
            'get_callback' => array($this, 'get_rank_math_seo_fields'),
            'schema'       => array(
                'description' => 'Rank Math structured SEO metadata',
                'type'        => 'object',
            ),
        ));

        // Expose dynamic reading time field in /wp/v2/posts and /wp/v2/pages
        register_rest_field(array('post', 'page'), 'reading_time', array(
            'get_callback' => array($this, 'get_reading_time'),
            'schema'       => array(
                'description' => 'Estimated reading time calculated server-side from full post content',
                'type'        => 'string',
            ),
        ));

        // Enable REST updating for Rank Math Redirection fields
        foreach (array('post', 'page') as $pt) {
            register_post_meta($pt, 'rank_math_redirection_url', array(
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => 'string',
                'auth_callback' => function() { return current_user_can('edit_posts'); },
            ));
            register_post_meta($pt, 'rank_math_redirection_type', array(
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => 'string',
                'auth_callback' => function() { return current_user_can('edit_posts'); },
            ));
        }

        // Dedicated endpoint: /wp-json/headless/v1/head?slug=...
        register_rest_route('headless/v1', '/head', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'rest_get_rendered_head'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'slug' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_title',
                ),
            ),
        ));

        // Dedicated endpoint: /wp-json/headless/v1/redirection?slug=...
        register_rest_route('headless/v1', '/redirection', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'rest_get_redirection'),
            'permission_callback' => '__return_true',
            'args'                => array(
                'slug' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ));

        // Dedicated endpoint: /wp-json/headless/v1/404-log
        register_rest_route('headless/v1', '/404-log', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'rest_get_404_log'),
            'permission_callback' => array($this, 'verify_secret_or_admin'),
            'args'                => array(
                'per_page' => array(
                    'default'           => 100,
                    'sanitize_callback' => 'absint',
                ),
                'page' => array(
                    'default'           => 1,
                    'sanitize_callback' => 'absint',
                ),
                'orderby' => array(
                    'default'           => 'times_accessed',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'order' => array(
                    'default'           => 'DESC',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'search' => array(
                    'default'           => '',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ));

        if (!is_user_logged_in()) {
            add_filter('rest_endpoints', function ($endpoints) {
                if (isset($endpoints['/wp/v2/users'])) {
                    unset($endpoints['/wp/v2/users']);
                }
                if (isset($endpoints['/wp/v2/users/(?P<id>[\d]+)'])) {
                    unset($endpoints['/wp/v2/users/(?P<id>[\d]+)']);
                }
                return $endpoints;
            });
        }
    }

    /**
     * Get rendered Rank Math head HTML for a post/page
     * Persistently cached in post meta to avoid executing heavy filters repeatedly
     */
    public function get_rank_math_head($post_arr) {
        $post_id = is_array($post_arr) ? ($post_arr['id'] ?? 0) : $post_arr;
        if (!$post_id) return null;

        $frontend_url = $this->get_frontend_url();

        // Check persistent post meta cache first (instant microsecond lookup)
        $cached_head = get_post_meta($post_id, '_headless_rm_head', true);
        if (!empty($cached_head)) {
            // Safety sanitization: guarantee production frontend domain
            return str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $cached_head);
        }

        if (!class_exists('\RankMath\Paper\Paper')) {
            return null;
        }

        $orig_post = $GLOBALS['post'] ?? null;
        $target_post = get_post($post_id);
        if (!$target_post) return null;

        $GLOBALS['post'] = $target_post;
        setup_postdata($target_post);

        ob_start();
        do_action('rank_math/head');
        $head = ob_get_clean();

        if ($orig_post) {
            $GLOBALS['post'] = $orig_post;
            setup_postdata($orig_post);
        } else {
            wp_reset_postdata();
        }

        $clean_head = !empty($head) ? trim($head) : null;
        if ($clean_head) {
            // Rewrite all backend URL occurrences to the configured frontend domain
            $wp_site_url = site_url();
            $wp_home_url = home_url();
            $search_urls = array_unique(array_filter(array(
                $wp_site_url,
                $wp_home_url,
                'https://wp.topnepali.com',
                'http://wp.topnepali.com',
            )));
            $clean_head = str_replace($search_urls, $frontend_url, $clean_head);
            update_post_meta($post_id, '_headless_rm_head', $clean_head);
        }

        return $clean_head;
    }

    /**
     * Resolve Rank Math template variables (%title%, %currentyear%, %sep%, etc.)
     */
    private function resolve_seo_template_vars($template, $post_obj) {
        $target_post = is_numeric($post_obj) ? get_post($post_obj) : $post_obj;
        $title = $target_post ? $target_post->post_title : '';
        $site_name = get_bloginfo('name') ?: 'Top Nepali';

        if (empty($template) || !is_string($template)) {
            return $title;
        }

        // If template only contains brackets or punctuation (like "()", "[]", "-"), discard it
        $stripped = trim(preg_replace('/[\(\)\[\]\-\—\s\|]/', '', $template));
        if (empty($stripped)) {
            return $title;
        }

        $excerpt = '';
        if ($target_post) {
            $excerpt = !empty($target_post->post_excerpt)
                ? wp_strip_all_tags($target_post->post_excerpt)
                : wp_trim_words(wp_strip_all_tags($target_post->post_content), 30);
        }

        $cats = $target_post ? get_the_category($target_post->ID) : array();
        $cat_name = (!empty($cats) && !is_wp_error($cats)) ? $cats[0]->name : '';

        $resolved = str_ireplace(
            array(
                '%title%',
                '%currentyear%',
                '%currentmonth%',
                '%currentday%',
                '%sep%',
                '%sitename%',
                '%page%',
                '%category%',
                '%excerpt%',
                '%focuskw%',
            ),
            array(
                $title,
                date('Y'),
                date('F'),
                date('j'),
                '—',
                $site_name,
                '',
                $cat_name,
                $excerpt,
                '',
            ),
            $template
        );

        // Strip any residual unknown %...% placeholders
        $resolved = preg_replace('/%[a-z0-9_-]+%/i', '', $resolved);
        $resolved = trim(preg_replace('/\s+/', ' ', $resolved));

        // If after resolution, the title only contains punctuation/brackets/separators (like "()", "() — Top Nepali", "—", etc.)
        $test_without_punct = trim(str_ireplace($site_name, '', $resolved));
        $test_without_punct = trim(preg_replace('/[\(\)\[\]\-\—\s\|\:\,]/', '', $test_without_punct));

        if (empty($test_without_punct)) {
            return $title;
        }

        return $resolved;
    }

    /**
     * Calculate dynamic reading time based on post content word count
     */
    public function get_reading_time($post_arr) {
        $post_id = is_array($post_arr) ? ($post_arr['id'] ?? 0) : $post_arr;
        if (!$post_id) return '1 min read';
        $post = get_post($post_id);
        if (!$post || empty($post->post_content)) return '1 min read';
        $clean = wp_strip_all_tags(strip_shortcodes($post->post_content));
        $words = count(preg_split('/\s+/u', trim($clean), -1, PREG_SPLIT_NO_EMPTY));
        $minutes = max(1, (int) ceil($words / 200));
        return $minutes . ' min read';
    }

    /**
     * Get structured Rank Math SEO fields for a post/page
     */
    public function get_rank_math_seo_fields($post_arr) {
        $post_id = is_array($post_arr) ? ($post_arr['id'] ?? 0) : $post_arr;
        if (!$post_id) return null;

        $target_post = get_post($post_id);
        $frontend_url = $this->get_frontend_url();

        $raw_title     = get_post_meta($post_id, 'rank_math_title', true);
        $raw_desc      = get_post_meta($post_id, 'rank_math_description', true);
        $raw_canonical = get_post_meta($post_id, 'rank_math_canonical_url', true);
        $raw_og_title  = get_post_meta($post_id, 'rank_math_facebook_title', true);
        $raw_og_desc   = get_post_meta($post_id, 'rank_math_facebook_description', true);
        $raw_tw_title  = get_post_meta($post_id, 'rank_math_twitter_title', true);
        $raw_tw_desc   = get_post_meta($post_id, 'rank_math_twitter_description', true);

        $canonical = $raw_canonical ? str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $raw_canonical) : null;

        // Rank Math Redirection detection
        $redirect_to = get_post_meta($post_id, 'rank_math_redirection_url', true);
        $redirect_code = get_post_meta($post_id, 'rank_math_redirection_type', true) ?: '301';

        global $wpdb;
        $table_name = $wpdb->prefix . 'rank_math_redirections';
        if (empty($redirect_to) && $target_post && $wpdb->get_var("SHOW TABLES LIKE '{$table_name}'") === $table_name) {
            $slug = $target_post->post_name;
            if ($slug) {
                $row = $wpdb->get_row($wpdb->prepare(
                    "SELECT url_to, header_code FROM {$table_name} WHERE status = 'active' AND (object_id = %d OR sources LIKE %s) ORDER BY id DESC LIMIT 1",
                    $post_id,
                    '%' . $wpdb->esc_like($slug) . '%'
                ), ARRAY_A);
                if ($row && !empty($row['url_to'])) {
                    $redirect_to = $row['url_to'];
                    $redirect_code = $row['header_code'] ?: '301';
                }
            }
        }

        return array(
            'title'          => $this->resolve_seo_template_vars($raw_title, $target_post) ?: ($target_post ? $target_post->post_title : null),
            'description'    => $this->resolve_seo_template_vars($raw_desc, $target_post) ?: null,
            'canonical_url'  => $canonical,
            'focus_keyword'  => get_post_meta($post_id, 'rank_math_focus_keyword', true) ?: null,
            'robots'         => get_post_meta($post_id, 'rank_math_robots', true) ?: null,
            'og_title'       => $this->resolve_seo_template_vars($raw_og_title, $target_post) ?: null,
            'og_description' => $this->resolve_seo_template_vars($raw_og_desc, $target_post) ?: null,
            'og_image'       => get_post_meta($post_id, 'rank_math_facebook_image', true) ?: null,
            'twitter_title'  => $this->resolve_seo_template_vars($raw_tw_title, $target_post) ?: null,
            'twitter_desc'   => $this->resolve_seo_template_vars($raw_tw_desc, $target_post) ?: null,
            'twitter_image'  => get_post_meta($post_id, 'rank_math_twitter_image', true) ?: null,
            'redirect_url'   => $redirect_to ? str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $redirect_to) : null,
            'redirect_type'  => $redirect_to ? (int) $redirect_code : null,
        );
    }

    /**
     * Dedicated REST Callback for /wp-json/headless/v1/head?slug=...
     */
    public function rest_get_rendered_head($request) {
        $slug = $request->get_param('slug');
        $posts = get_posts(array(
            'name'        => $slug,
            'post_type'   => array('post', 'page'),
            'post_status' => 'publish',
            'numberposts' => 1,
        ));

        if (empty($posts)) {
            return new WP_Error('not_found', 'Post or page not found', array('status' => 404));
        }

        $post = $posts[0];
        $head = $this->get_rank_math_head(array('id' => $post->ID));
        $seo  = $this->get_rank_math_seo_fields(array('id' => $post->ID));

        return rest_ensure_response(array(
            'id'    => $post->ID,
            'slug'  => $post->post_name,
            'head'  => $head,
            'seo'   => $seo,
        ));
    }

    /**
     * Dedicated REST Callback for /wp-json/headless/v1/redirection?slug=...
     */
    public function rest_get_redirection($request) {
        $slug = trim($request->get_param('slug'), '/');
        if (empty($slug)) {
            return new WP_Error('invalid_slug', 'Missing slug parameter', array('status' => 400));
        }

        global $wpdb;
        $frontend_url = $this->get_frontend_url();

        // 1. Check if matching post or page has redirect meta
        $post = get_page_by_path($slug, OBJECT, array('post', 'page'));
        if ($post) {
            $redirect_to = get_post_meta($post->ID, 'rank_math_redirection_url', true);
            $redirect_code = get_post_meta($post->ID, 'rank_math_redirection_type', true) ?: '301';
            if ($redirect_to) {
                return rest_ensure_response(array(
                    'redirect_url'  => str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $redirect_to),
                    'redirect_type' => (int) $redirect_code,
                ));
            }
        }

        // 2. Check Rank Math redirections table
        $table_name = $wpdb->prefix . 'rank_math_redirections';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table_name}'") === $table_name) {
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT url_to, header_code FROM {$table_name} WHERE status = 'active' AND sources LIKE %s ORDER BY id DESC LIMIT 1",
                '%' . $wpdb->esc_like($slug) . '%'
            ), ARRAY_A);
            if ($row && !empty($row['url_to'])) {
                return rest_ensure_response(array(
                    'redirect_url'  => str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $row['url_to']),
                    'redirect_type' => (int) ($row['header_code'] ?: 301),
                ));
            }
        }

        return new WP_Error('not_found', 'No redirection found for slug', array('status' => 404));
    }

    /**
     * Permission callback: require secret query param, logged-in admin, or valid MCP OAuth token
     */
    public function verify_secret_or_admin($request) {
        if (current_user_can('manage_options')) {
            return true;
        }
        $provided = $request->get_param('secret');
        if (!empty($provided) && hash_equals($this->get_secret(), $provided)) {
            return true;
        }
        // Accept Easy MCP AI OAuth bearer tokens
        $auth_header = $request->get_header('authorization');
        if (!empty($auth_header) && stripos($auth_header, 'Bearer wpmcp_') === 0) {
            $token = substr($auth_header, 7);
            // Validate via Easy MCP AI plugin's token check
            if (function_exists('easy_mcp_ai_validate_token')) {
                $user_id = easy_mcp_ai_validate_token($token);
                if ($user_id && user_can($user_id, 'manage_options')) {
                    return true;
                }
            }
            // Fallback: check token directly in options
            global $wpdb;
            $token_hash = hash('sha256', $token);
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT user_id FROM {$wpdb->prefix}easy_mcp_ai_tokens WHERE token_hash = %s AND expires_at > NOW() LIMIT 1",
                $token_hash
            ));
            if ($row && user_can((int) $row->user_id, 'manage_options')) {
                return true;
            }
        }
        return new WP_Error('rest_forbidden', 'Authentication required', array('status' => 403));
    }

    /**
     * REST Callback: /wp-json/headless/v1/404-log
     * Reads the Rank Math 404 monitor log from wp_rank_math_404_log table
     */
    public function rest_get_404_log($request) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'rank_math_404_log';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table_name}'") !== $table_name) {
            return new WP_Error('no_table', 'Rank Math 404 log table not found. Is the 404 Monitor module enabled?', array('status' => 404));
        }

        $per_page = min(absint($request->get_param('per_page') ?: 100), 500);
        $page     = max(absint($request->get_param('page') ?: 1), 1);
        $offset   = ($page - 1) * $per_page;

        $allowed_orderby = array('times_accessed', 'accessed', 'uri');
        $orderby = in_array($request->get_param('orderby'), $allowed_orderby, true)
            ? $request->get_param('orderby')
            : 'times_accessed';

        $order = strtoupper($request->get_param('order')) === 'ASC' ? 'ASC' : 'DESC';

        $search = $request->get_param('search');
        $where  = '';
        if (!empty($search)) {
            $where = $wpdb->prepare(' WHERE uri LIKE %s OR referer LIKE %s',
                '%' . $wpdb->esc_like($search) . '%',
                '%' . $wpdb->esc_like($search) . '%'
            );
        }

        $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table_name}{$where}");

        $rows = $wpdb->get_results(
            "SELECT id, uri, referer, user_agent, times_accessed, accessed FROM {$table_name}{$where} ORDER BY {$orderby} {$order} LIMIT {$per_page} OFFSET {$offset}",
            ARRAY_A
        );

        return rest_ensure_response(array(
            'total'    => $total,
            'page'     => $page,
            'per_page' => $per_page,
            'pages'    => ceil($total / $per_page),
            'logs'     => $rows ?: array(),
        ));
    }

    /**
     * Synchronize default legacy tool redirections to Rank Math
     */
    public function sync_default_tool_redirections() {
        if (get_option('topnepali_tools_redirect_synced_v1')) {
            return;
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'rank_math_redirections';
        $frontend_url = $this->get_frontend_url();

        $tools = array(
            'nepali-date-converter' => '/tools/nepali-date-converter',
            'nepali-calendar' => '/tools/calendar',
            'nepali-land-area-converter' => '/tools/nepali-land-area-converter',
            'foreign-exchange-rates-for-nepali-currency' => '/tools/forex',
            'share-profit-and-commission-calculator' => '/tools/share-calculator',
        );

        $has_rm_table = ($wpdb->get_var("SHOW TABLES LIKE '{$table_name}'") === $table_name);

        foreach ($tools as $slug => $dest) {
            $post = get_page_by_path($slug, OBJECT, array('post', 'page'));
            if ($post) {
                update_post_meta($post->ID, 'rank_math_redirection_url', $dest);
                update_post_meta($post->ID, 'rank_math_redirection_type', '301');
                update_post_meta($post->ID, 'rank_math_has_redirect', 'yes');
            }

            if ($has_rm_table) {
                $exists = $wpdb->get_var($wpdb->prepare(
                    "SELECT id FROM {$table_name} WHERE sources LIKE %s LIMIT 1",
                    '%' . $wpdb->esc_like($slug) . '%'
                ));
                if (!$exists) {
                    $sources = serialize(array(
                        array(
                            'pattern'    => $slug,
                            'comparison' => 'exact',
                            'ignore'     => '1',
                        )
                    ));
                    $wpdb->insert($table_name, array(
                        'sources'     => $sources,
                        'url_to'      => $dest,
                        'header_code' => 301,
                        'hits'        => 0,
                        'status'      => 'active',
                        'created'     => current_time('mysql'),
                        'updated'     => current_time('mysql'),
                        'object_id'   => $post ? $post->ID : 0,
                        'object_type' => $post ? $post->post_type : 'post',
                    ));
                }
            }
        }

        update_option('topnepali_tools_redirect_synced_v1', 1);
    }

    /**
     * Redirect public frontend visitors from wp.topnepali.com to production topnepali.com
     * Preserves WordPress Admin, REST API, Cron, and preview functions.
     */
    public function handle_frontend_redirect() {
        if (is_admin()) return;
        if (defined('REST_REQUEST') && REST_REQUEST) return;
        if (defined('DOING_CRON') && DOING_CRON) return;
        if (is_preview()) return;
        if (isset($_GET['preview']) && $_GET['preview'] === 'true') return;

        // Allow XML sitemaps and XSL stylesheets to render natively without frontend redirection
        $req_uri = $_SERVER['REQUEST_URI'] ?? '/';
        $req_path = parse_url($req_uri, PHP_URL_PATH) ?: '';
        if (
            preg_match('/(sitemap.*\.xml|.*-sitemap.*\.xml|.*\.xsl)$/i', $req_path) ||
            isset($_GET['sitemap']) ||
            isset($_GET['sitemap_index']) ||
            isset($_GET['sitemap_n'])
        ) {
            return;
        }

        // Block author enumeration via ?author=1
        if (isset($_GET['author'])) {
            wp_die('Author enumeration is disabled on Headless backend.', 'Forbidden', array('response' => 403));
        }

        $frontend_url = $this->get_frontend_url();
        $req_uri = $_SERVER['REQUEST_URI'] ?? '/';

        // 301 Permanent redirect to canonical frontend
        wp_redirect(rtrim($frontend_url, '/') . $req_uri, 301);
        exit;
    }

    /**
     * Send noindex, nofollow and security headers on WordPress backend responses
     */
    public function send_backend_security_headers() {
        if (!headers_sent()) {
            header('X-Robots-Tag: noindex, nofollow', true);
            header('X-Content-Type-Options: nosniff', true);
        }
    }

    /**
     * Filter Rank Math canonical and OG URLs to production frontend
     */
    public function filter_rank_math_url($url) {
        if (empty($url)) return $url;
        $frontend_url = $this->get_frontend_url();
        return str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $url);
    }

    public function filter_rank_math_sitemap_url($url, $type = '') {
        if (empty($url)) return $url;
        $frontend_url = $this->get_frontend_url();
        return str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $url);
    }

    public function filter_rank_math_sitemap_entry($entry, $type = '', $item = null) {
        if (!is_array($entry)) return $entry;
        $frontend_url = $this->get_frontend_url();
        if (!empty($entry['loc'])) {
            $entry['loc'] = str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $entry['loc']);
        }
        return $entry;
    }

    public function filter_rank_math_sitemap_xml_text($xml) {
        if (empty($xml)) return $xml;
        $frontend_url = $this->get_frontend_url();
        return str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $xml);
    }

    /**
     * Filter Rank Math JSON-LD structured data to ensure production URLs
     */
    public function filter_rank_math_json_ld($data) {
        if (empty($data)) return $data;
        $frontend_url = $this->get_frontend_url();
        $json = wp_json_encode($data);
        if ($json) {
            $json = str_replace(array('https://wp.topnepali.com', 'http://wp.topnepali.com'), $frontend_url, $json);
            $decoded = json_decode($json, true);
            if (is_array($decoded)) return $decoded;
        }
        return $data;
    }

    /**
     * Settings Page Registration
     */
    public function register_admin_menu() {
        add_options_page(
            'Headless Settings',
            'Headless Setup',
            'manage_options',
            'topnepali-headless',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting('topnepali_headless_group', self::OPTION_FRONTEND_URL, array(
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default'           => 'https://topnepali.com',
        ));
        register_setting('topnepali_headless_group', self::OPTION_SECRET, array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => 'topnepali_revalidate_secure_token',
        ));
        register_setting('topnepali_headless_group', self::OPTION_REWRITE_LINKS, array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '1',
        ));
        register_setting('topnepali_headless_group', self::OPTION_AUTO_UPDATE, array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '1',
        ));
    }

    /**
     * Register Admin Bar Quick Actions for Instant Cache Purging
     */
    public function register_admin_bar_menu($admin_bar) {
        if (!current_user_can('edit_posts')) return;

        $title = '<span class="ab-icon dashicons dashicons-rest-api"></span><span class="ab-label">TopNepali Cache</span>';

        $admin_bar->add_node(array(
            'id'    => 'topnepali-cache',
            'title' => $title,
            'href'  => admin_url('options-general.php?page=topnepali-headless'),
            'meta'  => array('title' => 'TopNepali Headless Cache Tools'),
        ));

        // Purge current post if editing or viewing
        $current_post_id = 0;
        if (is_admin()) {
            global $post;
            if ($post && !empty($post->ID)) {
                $current_post_id = $post->ID;
            }
        }

        if ($current_post_id) {
            $nonce_url = wp_nonce_url(
                admin_url('admin-post.php?action=topnepali_purge_single&post_id=' . $current_post_id),
                'topnepali_purge_single_nonce'
            );
            $admin_bar->add_node(array(
                'id'     => 'topnepali-purge-current',
                'parent' => 'topnepali-cache',
                'title'  => 'Purge Current Post Cache',
                'href'   => $nonce_url,
            ));
        }

        // Purge entire site
        $nonce_all_url = wp_nonce_url(
            admin_url('admin-post.php?action=topnepali_purge_all'),
            'topnepali_purge_all_nonce'
        );
        $admin_bar->add_node(array(
            'id'     => 'topnepali-purge-all',
            'parent' => 'topnepali-cache',
            'title'  => 'Purge Entire Frontend Cache',
            'href'   => $nonce_all_url,
        ));

        // Pre-warm cache
        $nonce_warm_url = wp_nonce_url(
            admin_url('admin-post.php?action=topnepali_warm_all'),
            'topnepali_warm_all_nonce'
        );
        $admin_bar->add_node(array(
            'id'     => 'topnepali-warm-all',
            'parent' => 'topnepali-cache',
            'title'  => 'Pre-Warm Edge CDN',
            'href'   => $nonce_warm_url,
        ));
    }

    /**
     * Handle Admin Bar Action Handlers
     */
    public function handle_admin_bar_purge() {
        if (!current_user_can('edit_posts')) return;

        // Handle single post purge
        if (isset($_GET['action']) && $_GET['action'] === 'topnepali_purge_single' && isset($_GET['post_id'])) {
            check_admin_referer('topnepali_purge_single_nonce');
            $post_id = intval($_GET['post_id']);
            $post = get_post($post_id);
            if ($post) {
                delete_post_meta($post_id, '_headless_rm_head');
                $this->dispatch_revalidation($post->post_name, $post->post_type, 'update');
            }
            wp_safe_redirect(add_query_arg('topnepali_msg', 'purged_single', wp_get_referer() ?: admin_url()));
            exit;
        }

        // Handle entire cache purge
        if (isset($_GET['action']) && $_GET['action'] === 'topnepali_purge_all') {
            check_admin_referer('topnepali_purge_all_nonce');
            $this->dispatch_revalidation(null, 'all', 'purge', array('/', '/blogs', '/rss.xml', '/sitemap.xml', '/tools'));
            wp_safe_redirect(add_query_arg('topnepali_msg', 'purged_all', wp_get_referer() ?: admin_url()));
            exit;
        }

        // Handle pre-warm
        if (isset($_GET['action']) && $_GET['action'] === 'topnepali_warm_all') {
            check_admin_referer('topnepali_warm_all_nonce');
            $this->warm_recent_content();
            wp_safe_redirect(add_query_arg('topnepali_msg', 'warmed_all', wp_get_referer() ?: admin_url()));
            exit;
        }
    }

    /**
     * Helper to warm recent content
     */
    public function warm_recent_content() {
        $recent_posts = get_posts(array(
            'numberposts' => 20,
            'post_status' => 'publish',
            'post_type'   => 'post',
        ));
        $urls = array('/', '/blogs', '/rss.xml', '/sitemap.xml');
        foreach ($recent_posts as $p) {
            $urls[] = '/' . $p->post_name;
        }
        $cats = get_categories(array('number' => 12, 'hide_empty' => true));
        foreach ($cats as $c) {
            $urls[] = '/category/' . $c->slug;
        }
        return $this->warm_cache($urls);
    }

    /**
     * Handle Admin Settings Page Forms (Specific URL purge, Full purge, Warm, Test)
     */
    public function handle_admin_cache_actions() {
        if (!current_user_can('manage_options')) return;

        // Purge specific custom path or URL
        if (isset($_POST['topnepali_purge_custom_url']) && check_admin_referer('topnepali_purge_custom_action', 'topnepali_purge_custom_nonce')) {
            $raw_url = trim($_POST['topnepali_custom_url'] ?? '');
            if (!empty($raw_url)) {
                $path = parse_url($raw_url, PHP_URL_PATH) ?: $raw_url;
                $clean_path = '/' . ltrim($path, '/');
                $this->dispatch_revalidation(null, 'custom', 'purge', array($clean_path));
                set_transient('topnepali_admin_notice', array(
                    'type'    => 'success',
                    'message' => 'Successfully purged specific URL from Cloudflare Edge & Astro SSR: ' . esc_html($clean_path),
                ), 30);
            }
            wp_safe_redirect(admin_url('options-general.php?page=topnepali-headless'));
            exit;
        }

        // Purge entire site cache
        if (isset($_POST['topnepali_purge_entire_cache']) && check_admin_referer('topnepali_purge_entire_action', 'topnepali_purge_entire_nonce')) {
            $this->dispatch_revalidation(null, 'all', 'purge', array('/', '/blogs', '/rss.xml', '/sitemap.xml', '/tools'));
            set_transient('topnepali_admin_notice', array(
                'type'    => 'success',
                'message' => 'Successfully purged entire frontend edge cache (Homepage, Blogs, RSS, Sitemap, and all dynamic pages).',
            ), 30);
            wp_safe_redirect(admin_url('options-general.php?page=topnepali-headless'));
            exit;
        }
    }

    /**
     * Render Admin Settings Form
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) return;

        $frontend_url = $this->get_frontend_url();
        $secret = $this->get_secret();
        $rewrite_links = get_option(self::OPTION_REWRITE_LINKS, '1');
        $auto_update = get_option(self::OPTION_AUTO_UPDATE, '1');

        $flash_notice = get_transient('topnepali_admin_notice');
        if ($flash_notice) {
            delete_transient('topnepali_admin_notice');
        }

        $test_result = null;
        if (isset($_POST['topnepali_test_revalidate']) && check_admin_referer('topnepali_test_action', 'topnepali_test_nonce')) {
            $test_endpoint = $frontend_url . '/api/revalidate?secret=' . rawurlencode($secret);
            $response = wp_remote_post($test_endpoint, array(
                'timeout' => 8,
                'headers' => array(
                    'Content-Type'        => 'application/json',
                    'Origin'              => $frontend_url,
                    'Referer'             => $frontend_url,
                    'x-revalidate-secret' => $secret,
                ),
                'body' => wp_json_encode(array(
                    'slug'   => 'test-connection',
                    'type'   => 'test',
                    'action' => 'ping'
                )),
            ));

            if (is_wp_error($response)) {
                $test_result = array('success' => false, 'message' => $response->get_error_message());
            } else {
                $code = wp_remote_retrieve_response_code($response);
                $body = wp_remote_retrieve_body($response);
                $test_result = array(
                    'success' => ($code === 200),
                    'code'    => $code,
                    'message' => $body
                );
            }
        }

        $warm_result = null;
        if (isset($_POST['topnepali_warm_recent']) && check_admin_referer('topnepali_warm_action', 'topnepali_warm_nonce')) {
            $count = $this->warm_recent_content();
            $warm_result = array(
                'success' => true,
                'count'   => $count,
                'message' => "Successfully triggered background cache warming for {$count} URLs directly on Cloudflare Edge CDN."
            );
        }

        // Check for updates form trigger
        $update_check_msg = null;
        $update_available = false;
        $update_version = null;
        $update_url = null;
        if (isset($_POST['topnepali_check_updates']) && check_admin_referer('topnepali_update_action', 'topnepali_update_nonce')) {
            $remote_info = $this->get_remote_info(true);

            // Invalidate WordPress core update transient to register the update across WP immediately
            delete_site_transient('update_plugins');
            wp_clean_plugins_cache();

            if (!empty($remote_info['version'])) {
                if (version_compare(self::VERSION, $remote_info['version'], '<')) {
                    $update_available = true;
                    $update_version = $remote_info['version'];
                    $plugin_file = plugin_basename(__FILE__);
                    $update_url = wp_nonce_url(
                        self_admin_url('update.php?action=upgrade-plugin&plugin=' . urlencode($plugin_file)),
                        'upgrade-plugin_' . $plugin_file
                    );
                    $update_check_msg = 'A newer version (v' . esc_html($remote_info['version']) . ') is available!';
                } else {
                    $update_check_msg = 'Your TopNepali Headless plugin is up to date (v' . esc_html(self::VERSION) . ').';
                }
            } else {
                $update_check_msg = 'Could not contact Astro Cloudflare update endpoint. Please check your Frontend URL and Secret Token.';
            }
        }
        ?>
        <div class="wrap">
            <h1>TopNepali Headless Configuration & Cache Manager</h1>
            <p>Connects your WordPress backend with your Astro SSR / Cloudflare Edge frontend for instant cache revalidation, granular purging, and pre-warming.</p>

            <?php if ($flash_notice): ?>
                <div class="notice notice-<?php echo esc_attr($flash_notice['type']); ?> is-dismissible">
                    <p><strong>Cache Manager:</strong> <?php echo esc_html($flash_notice['message']); ?></p>
                </div>
            <?php endif; ?>

            <?php if ($update_check_msg): ?>
                <div class="notice notice-<?php echo $update_available ? 'warning' : 'info'; ?> is-dismissible" style="padding: 12px 15px;">
                    <p style="margin: 0 0 <?php echo $update_available ? '10px' : '0'; ?> 0;">
                        <strong>Plugin Updates:</strong> <?php echo esc_html($update_check_msg); ?>
                    </p>
                    <?php if ($update_available && $update_url): ?>
                        <p style="margin: 0;">
                            <a href="<?php echo esc_url($update_url); ?>" class="button button-primary" style="margin-right: 8px;">
                                Update to v<?php echo esc_html($update_version); ?> Now
                            </a>
                            <a href="<?php echo esc_url(admin_url('plugins.php')); ?>" class="button button-secondary">
                                View on Plugins Screen
                            </a>
                        </p>
                    <?php endif; ?>
                </div>
            <?php endif; ?>

            <?php if ($test_result): ?>
                <div class="notice notice-<?php echo $test_result['success'] ? 'success' : 'error'; ?> is-dismissible">
                    <p><strong>Connection Test Result (Status: <?php echo esc_html($test_result['code'] ?? 'Error'); ?>):</strong></p>
                    <pre style="background:#fff;padding:8px;border-radius:4px;"><?php echo esc_html($test_result['message']); ?></pre>
                </div>
            <?php endif; ?>

            <?php if ($warm_result): ?>
                <div class="notice notice-success is-dismissible">
                    <p><strong>Cache Warmer:</strong> <?php echo esc_html($warm_result['message']); ?></p>
                </div>
            <?php endif; ?>

            <form method="post" action="options.php">
                <?php
                settings_fields('topnepali_headless_group');
                do_settings_sections('topnepali_headless_group');
                ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="<?php echo esc_attr(self::OPTION_FRONTEND_URL); ?>">Frontend Astro URL</label></th>
                        <td>
                            <input
                                name="<?php echo esc_attr(self::OPTION_FRONTEND_URL); ?>"
                                type="url"
                                id="<?php echo esc_attr(self::OPTION_FRONTEND_URL); ?>"
                                value="<?php echo esc_attr($frontend_url); ?>"
                                class="regular-text"
                                placeholder="https://topnepali.com"
                                required
                            />
                            <p class="description">The public production URL of your Astro / Cloudflare Pages site.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="<?php echo esc_attr(self::OPTION_SECRET); ?>">Revalidation Secret Token</label></th>
                        <td>
                            <input
                                name="<?php echo esc_attr(self::OPTION_SECRET); ?>"
                                type="password"
                                id="<?php echo esc_attr(self::OPTION_SECRET); ?>"
                                value="<?php echo esc_attr($secret); ?>"
                                class="regular-text"
                                required
                            />
                            <p class="description">Must match <code>REVALIDATE_SECRET</code> in your Astro Cloudflare environment variables.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Rewrite Preview & View Links</th>
                        <td>
                            <label for="<?php echo esc_attr(self::OPTION_REWRITE_LINKS); ?>">
                                <input
                                    name="<?php echo esc_attr(self::OPTION_REWRITE_LINKS); ?>"
                                    type="checkbox"
                                    id="<?php echo esc_attr(self::OPTION_REWRITE_LINKS); ?>"
                                    value="1"
                                    <?php checked('1', $rewrite_links); ?>
                                />
                                Rewrite "View Post" and preview buttons in WP Admin to point directly to the Headless frontend.
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Automatic Background Updates</th>
                        <td>
                            <label for="<?php echo esc_attr(self::OPTION_AUTO_UPDATE); ?>">
                                <input
                                    name="<?php echo esc_attr(self::OPTION_AUTO_UPDATE); ?>"
                                    type="checkbox"
                                    id="<?php echo esc_attr(self::OPTION_AUTO_UPDATE); ?>"
                                    value="1"
                                    <?php checked('1', $auto_update); ?>
                                />
                                Enable native WordPress automatic background updates for TopNepali Headless.
                            </label>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Save Headless Settings'); ?>
            </form>

            <hr style="margin: 30px 0;" />

            <h2>Granular Cache Management (Cloudflare Edge & Astro SSR)</h2>
            <p>Purge specific URLs or the entire website cache on demand across Cloudflare Global Edge CDN.</p>
            
            <div style="background:#fff;border:1px solid #ccd0d4;padding:15px;border-radius:6px;max-width:800px;margin-bottom:20px;">
                <h3 style="margin-top:0;">Purge Specific URL / Path</h3>
                <form method="post" action="">
                    <?php wp_nonce_field('topnepali_purge_custom_action', 'topnepali_purge_custom_nonce'); ?>
                    <p>Enter any specific path to purge instantly (e.g., <code>/exam-routines</code> or <code>/category/education</code>):</p>
                    <input
                        type="text"
                        name="topnepali_custom_url"
                        class="regular-text"
                        placeholder="/exam-routines"
                        required
                    />
                    <button type="submit" class="button button-secondary" name="topnepali_purge_custom_url">
                        Purge Specific URL Cache
                    </button>
                </form>
            </div>

            <div style="background:#fff;border:1px solid #ccd0d4;padding:15px;border-radius:6px;max-width:800px;margin-bottom:20px;">
                <h3 style="margin-top:0;">Purge Entire Website Cache</h3>
                <p>Immediately purges the homepage, blogs, RSS feed, sitemap, and all cached dynamic pages.</p>
                <form method="post" action="" onsubmit="return confirm('Are you sure you want to purge the entire site cache?');">
                    <?php wp_nonce_field('topnepali_purge_entire_action', 'topnepali_purge_entire_nonce'); ?>
                    <button type="submit" class="button button-secondary" name="topnepali_purge_entire_cache">
                        Purge Entire Frontend Cache
                    </button>
                </form>
            </div>

            <div style="background:#fff;border:1px solid #ccd0d4;padding:15px;border-radius:6px;max-width:800px;margin-bottom:20px;">
                <h3 style="margin-top:0;">Pre-Warm Edge CDN Cache</h3>
                <p>Proactively warms Cloudflare edge caches for instant sub-50ms responses for all visitors.</p>
                <form method="post" action="">
                    <?php wp_nonce_field('topnepali_warm_action', 'topnepali_warm_nonce'); ?>
                    <input type="hidden" name="topnepali_warm_recent" value="1" />
                    <button type="submit" class="button button-primary">
                        Pre-Warm Top 20 Posts & Archives
                    </button>
                </form>
            </div>

            <hr style="margin: 30px 0;" />

            <h2>Plugin Updates & Connectivity</h2>
            <p>Installed Version: <strong>v<?php echo esc_html(self::VERSION); ?></strong></p>
            <p>Updates are delivered safely as standard zip archives via WordPress core's native upgrader with zero raw file write risks.</p>
            <form method="post" action="" style="display:inline-block;margin-right:10px;">
                <?php wp_nonce_field('topnepali_update_action', 'topnepali_update_nonce'); ?>
                <input type="hidden" name="topnepali_check_updates" value="1" />
                <button type="submit" class="button button-secondary">
                    Check for Plugin Updates Now
                </button>
            </form>

            <form method="post" action="" style="display:inline-block;">
                <?php wp_nonce_field('topnepali_test_action', 'topnepali_test_nonce'); ?>
                <input type="hidden" name="topnepali_test_revalidate" value="1" />
                <button type="submit" class="button button-secondary">
                    Test Webhook Connection
                </button>
            </form>
        </div>
        <?php
    }

    /**
     * Check for plugin updates using WordPress core's native update pipeline
     *
     * @param object $transient The update_plugins site transient
     * @return object
     */
    public function check_for_update($transient) {
        if (empty($transient) || !is_object($transient)) {
            return $transient;
        }

        $plugin_file = plugin_basename(__FILE__);
        $remote_info = $this->get_remote_info();

        if (empty($remote_info) || empty($remote_info['version'])) {
            return $transient;
        }

        $item = new stdClass();
        $item->id           = 'topnepali-headless';
        $item->slug         = 'topnepali-headless';
        $item->plugin       = $plugin_file;
        $item->new_version  = $remote_info['version'];
        $item->url          = !empty($remote_info['homepage']) ? $remote_info['homepage'] : 'https://topnepali.com';
        $item->package      = !empty($remote_info['download_url']) ? $remote_info['download_url'] : '';
        $item->tested       = !empty($remote_info['tested']) ? $remote_info['tested'] : '6.7';
        $item->requires     = !empty($remote_info['requires']) ? $remote_info['requires'] : '5.6';
        $item->requires_php = !empty($remote_info['requires_php']) ? $remote_info['requires_php'] : '7.4';
        $item->autoupdate   = (bool) get_option(self::OPTION_AUTO_UPDATE, '1');

        if (version_compare(self::VERSION, $remote_info['version'], '<')) {
            $transient->response[$plugin_file] = $item;
            if (isset($transient->no_update[$plugin_file])) {
                unset($transient->no_update[$plugin_file]);
            }
        } else {
            $transient->no_update[$plugin_file] = $item;
            if (isset($transient->response[$plugin_file])) {
                unset($transient->response[$plugin_file]);
            }
        }

        return $transient;
    }

    /**
     * Display plugin details modal in WordPress Admin (View details)
     *
     * @param false|object|array $result The result object
     * @param string $action The type of information being requested
     * @param object $args Plugin API arguments
     * @return false|object
     */
    public function plugin_popup_info($result, $action, $args) {
        if ($action !== 'plugin_information') {
            return $result;
        }

        if (empty($args->slug) || $args->slug !== 'topnepali-headless') {
            return $result;
        }

        $remote_info = $this->get_remote_info();
        if (empty($remote_info)) {
            return $result;
        }

        $res = new stdClass();
        $res->name          = !empty($remote_info['name']) ? $remote_info['name'] : 'TopNepali Headless Engine';
        $res->slug          = 'topnepali-headless';
        $res->version       = !empty($remote_info['version']) ? $remote_info['version'] : self::VERSION;
        $res->author        = !empty($remote_info['author']) ? '<a href="' . esc_url($remote_info['homepage']) . '">' . esc_html($remote_info['author']) . '</a>' : '<a href="https://topnepali.com">Top Nepali</a>';
        $res->homepage      = !empty($remote_info['homepage']) ? $remote_info['homepage'] : 'https://topnepali.com';
        $res->download_link = !empty($remote_info['download_url']) ? $remote_info['download_url'] : '';
        $res->tested        = !empty($remote_info['tested']) ? $remote_info['tested'] : '6.7';
        $res->requires      = !empty($remote_info['requires']) ? $remote_info['requires'] : '5.6';
        $res->requires_php  = !empty($remote_info['requires_php']) ? $remote_info['requires_php'] : '7.4';
        $res->last_updated  = !empty($remote_info['last_updated']) ? $remote_info['last_updated'] : '';
        $res->sections      = !empty($remote_info['sections']) ? (array) $remote_info['sections'] : array(
            'description' => 'Enterprise Headless WordPress engine for Astro & Cloudflare Edge.',
            'changelog'   => 'Native WordPress update pipeline with automated granular cache invalidation.',
        );

        return $res;
    }

    /**
     * Filter to enable native automatic background updates for this plugin
     */
    public function filter_auto_update_plugin($update, $item) {
        if (!get_option(self::OPTION_AUTO_UPDATE, '1')) {
            return $update;
        }

        $plugin_file = plugin_basename(__FILE__);
        if (!empty($item->plugin) && ($item->plugin === $plugin_file || strpos($item->plugin, 'headless') !== false)) {
            return true;
        }

        return $update;
    }

    /**
     * Render native auto-update status in the WordPress Plugins screen table
     */
    public function filter_plugin_auto_update_html($html, $plugin_file, $plugin_data) {
        if ($plugin_file === plugin_basename(__FILE__)) {
            $auto_update = get_option(self::OPTION_AUTO_UPDATE, '1');
            $settings_url = admin_url('options-general.php?page=topnepali-headless');
            if ($auto_update === '1' || $auto_update === 1 || $auto_update === true) {
                return '<span class="label" style="color:#007017;font-weight:600;">Auto-updates enabled</span><br><a href="' . esc_url($settings_url) . '" style="font-size:11px;color:#555;">Managed in Headless Settings</a>';
            } else {
                return '<span class="label" style="color:#777;">Auto-updates disabled</span><br><a href="' . esc_url($settings_url) . '" style="font-size:11px;color:#2271b1;">Enable in Headless Settings</a>';
            }
        }
        return $html;
    }

    /**
     * Support WordPress 5.8+ Update URI hostname filter
     */
    public function filter_update_plugins_host($update, $plugin_data, $plugin_file, $locales = array()) {
        if ($plugin_file !== plugin_basename(__FILE__)) {
            return $update;
        }

        $remote_info = $this->get_remote_info();
        if (empty($remote_info) || empty($remote_info['version'])) {
            return $update;
        }

        if (version_compare(self::VERSION, $remote_info['version'], '<')) {
            return array(
                'slug'        => 'topnepali-headless',
                'version'     => $remote_info['version'],
                'url'         => !empty($remote_info['homepage']) ? $remote_info['homepage'] : 'https://topnepali.com',
                'package'     => !empty($remote_info['download_url']) ? $remote_info['download_url'] : '',
                'tested'      => !empty($remote_info['tested']) ? $remote_info['tested'] : '6.7',
                'requires'    => !empty($remote_info['requires']) ? $remote_info['requires'] : '5.6',
                'requires_php'=> !empty($remote_info['requires_php']) ? $remote_info['requires_php'] : '7.4',
                'autoupdate'  => (bool) get_option(self::OPTION_AUTO_UPDATE, '1'),
            );
        }

        return $update;
    }

    /**
     * Fetch remote version and metadata from Astro API with transient caching
     *
     * @param bool $force Force bypass transient cache
     * @return array|null
     */
    public function get_remote_info($force = false) {
        $transient_key = 'topnepali_headless_update_info';

        if (isset($_GET['force-check'])) {
            $force = true;
        }

        if (!$force) {
            $cached = get_transient($transient_key);
            if ($cached !== false && is_array($cached)) {
                return $cached;
            }
        }

        $frontend_url = $this->get_frontend_url();
        $secret = $this->get_secret();

        if (empty($frontend_url) || empty($secret)) {
            return null;
        }

        $info_url = add_query_arg(array(
            'action' => 'info',
            'secret' => $secret,
        ), $frontend_url . '/api/headless-plugin');

        $response = wp_remote_get($info_url, array(
            'timeout'   => 10,
            'sslverify' => true,
            'headers'   => array(
                'Accept'              => 'application/json',
                'x-revalidate-secret' => $secret,
                'User-Agent'          => 'TopNepali-WP-NativeUpdater/' . self::VERSION . '; ' . home_url(),
            ),
        ));

        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            return null;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (!is_array($data) || empty($data['version'])) {
            return null;
        }

        // Cache update check for 1 hour in transient
        set_transient($transient_key, $data, HOUR_IN_SECONDS);

        return $data;
    }
}

// Initialize plugin
new TopNepali_Headless_Plugin();
