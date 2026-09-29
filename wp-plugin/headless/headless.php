<?php
/**
 * Plugin Name: TopNepali Headless Engine
 * Plugin URI: https://topnepali.com
 * Description: High-performance Headless WordPress engine for Astro & Cloudflare Edge. Provides automatic on-demand cache revalidation, preview rewrites, Rank Math head bridge, and REST API edge caching.
 * Version: 1.2.2
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
    const VERSION = '1.2.2';
    const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/iamgrisma/topnepali/main/wp-plugin/headless/headless.php';

    const OPTION_FRONTEND_URL = 'topnepali_headless_frontend_url';
    const OPTION_SECRET = 'topnepali_headless_secret';
    const OPTION_REWRITE_LINKS = 'topnepali_headless_rewrite_links';

    private $cached_frontend_url = null;
    private $cached_secret = null;

    public function __construct() {
        // Lifecycle action hooks
        add_action('save_post', array($this, 'on_save_post'), 10, 3);
        add_action('wp_trash_post', array($this, 'on_trash_post'));
        add_action('untrash_post', array($this, 'on_trash_post'));

        // Admin-only hooks (zero overhead on public / REST API visits)
        if (is_admin()) {
            add_action('admin_menu', array($this, 'register_admin_menu'));
            add_action('admin_init', array($this, 'register_settings'));
            add_filter('site_transient_update_plugins', array($this, 'check_plugin_update'));

            // Block WordPress.org from ever checking or overriding this private in-house plugin
            add_filter('http_request_args', array($this, 'prevent_wporg_update_check'), 10, 2);
        }

        // Preview & View link rewrites
        add_filter('post_link', array($this, 'filter_permalink'), 10, 2);
        add_filter('page_link', array($this, 'filter_permalink'), 10, 2);
        add_filter('preview_post_link', array($this, 'filter_preview_link'), 10, 2);

        // REST API enhancements & Edge Caching
        add_action('rest_api_init', array($this, 'configure_rest_api'));
        add_filter('rest_post_dispatch', array($this, 'filter_rest_cache_headers'), 10, 3);
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
            $response->header('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
            $response->header('Cloudflare-CDN-Cache-Control', 'max-age=86400, stale-while-revalidate=86400');
            $response->header('X-Headless-Edge-Cache', 'ENABLED');
        }

        return $response;
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
     * Trigger non-blocking revalidation request to Astro Cloudflare worker and warm edge cache
     */
    public function dispatch_revalidation($slug = null, $type = 'post', $action = 'update', $extra_urls = array()) {
        $frontend_url = $this->get_frontend_url();
        $secret = $this->get_secret();

        if (empty($frontend_url) || empty($secret)) {
            return false;
        }

        $endpoint = $frontend_url . '/api/revalidate';

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
            'timeout'     => 4,
            'blocking'    => false, // Asynchronous
            'sslverify'   => true,
            'headers'     => array(
                'Content-Type'        => 'application/json',
                'x-revalidate-secret' => $secret,
            ),
            'body'        => wp_json_encode($payload),
            'data_format' => 'body',
        ));

        // Proactively warm the target URLs from WordPress in the background
        $warm_urls = array('/');
        if ($slug) {
            $warm_urls[] = '/' . ltrim($slug, '/');
        }
        if (!empty($extra_urls)) {
            $warm_urls = array_merge($warm_urls, $extra_urls);
        }

        $this->warm_cache($warm_urls);

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
     * Get the endpoint URL for checking updates or downloading the plugin
     * Routes via Cloudflare Edge API to support private GitHub repositories
     */
    public function get_update_endpoint($action = 'info') {
        $frontend_url = $this->get_frontend_url();
        $secret = $this->get_secret();
        $param = ($action === 'download') ? 'download=1' : 'info=1';
        $url = $frontend_url . '/api/headless-plugin?' . $param;
        if (!empty($secret)) {
            $url .= '&secret=' . urlencode($secret);
        }
        return $url;
    }

    /**
     * Prevent WordPress.org from overriding this plugin with directory plugins
     * Strips topnepali-headless from the update-check payload sent to api.wordpress.org
     */
    public function prevent_wporg_update_check($args, $url) {
        if (strpos($url, 'api.wordpress.org/plugins/update-check') === false) {
            return $args;
        }
        if (empty($args['body']['plugins'])) {
            return $args;
        }
        $plugins = json_decode($args['body']['plugins'], true);
        $plugin_file = plugin_basename(__FILE__);
        if (isset($plugins['plugins'][$plugin_file])) {
            unset($plugins['plugins'][$plugin_file]);
            $args['body']['plugins'] = wp_json_encode($plugins);
        }
        return $args;
    }

    /**
     * Check for plugin updates against Cloudflare Edge API / GitHub
     */
    public function check_plugin_update($transient) {
        if (empty($transient->checked)) {
            return $transient;
        }

        $remote_version = $this->get_remote_version();
        if ($remote_version && version_compare(self::VERSION, $remote_version, '<')) {
            $plugin_file = plugin_basename(__FILE__);
            $obj = new stdClass();
            $obj->slug = 'topnepali-headless';
            $obj->plugin = $plugin_file;
            $obj->new_version = $remote_version;
            $obj->url = $this->get_frontend_url();
            $obj->package = $this->get_update_endpoint('download');
            $obj->tested = '6.7';
            $obj->requires = '5.6';
            $transient->response[$plugin_file] = $obj;
        }

        return $transient;
    }

    /**
     * Get latest remote version from Cloudflare Edge distribution API
     * Supports private GitHub repositories seamlessly
     */
    public function get_remote_version($force = false) {
        $cached = get_transient('topnepali_headless_remote_ver');
        if (!$force && $cached !== false) {
            return $cached;
        }

        $url = $this->get_update_endpoint('info');
        $response = wp_remote_get($url, array(
            'timeout'   => 8,
            'sslverify' => true,
            'headers'   => array(
                'Accept'     => 'application/json',
                'User-Agent' => 'TopNepali-WP/' . self::VERSION,
            ),
        ));

        if (!is_wp_error($response)) {
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            if (!empty($data['version'])) {
                $ver = trim($data['version']);
                set_transient('topnepali_headless_remote_ver', $ver, 1800); // 30 mins
                return $ver;
            }
        }

        // Fallback: check GitHub raw in case frontend is unreachable
        $gh_response = wp_remote_get(self::GITHUB_RAW_URL, array(
            'timeout'   => 5,
            'sslverify' => true,
        ));

        if (!is_wp_error($gh_response)) {
            $content = wp_remote_retrieve_body($gh_response);
            if (preg_match('/Version:\s*([0-9\.]+)/i', $content, $matches)) {
                $ver = trim($matches[1]);
                set_transient('topnepali_headless_remote_ver', $ver, 1800);
                return $ver;
            }
        }

        return null;
    }

    /**
     * Perform 1-click in-place update of headless.php directly from Cloudflare Edge / Astro API
     * Seamlessly works with 100% PRIVATE GitHub repositories without any tokens or manual uploads
     */
    public function perform_in_place_update() {
        if (!current_user_can('update_plugins')) {
            return array('success' => false, 'message' => 'Unauthorized');
        }

        $url = $this->get_update_endpoint('download');
        $response = wp_remote_get($url, array(
            'timeout'   => 15,
            'sslverify' => true,
            'headers'   => array(
                'Accept'     => 'text/plain',
                'User-Agent' => 'TopNepali-WP-Updater/' . self::VERSION,
            ),
        ));

        $code = is_wp_error($response) ? 0 : wp_remote_retrieve_response_code($response);
        $body = is_wp_error($response) ? '' : wp_remote_retrieve_body($response);

        // Fallback: try GitHub raw if frontend download failed
        if ($code !== 200 || empty($body) || strpos($body, 'Plugin Name: TopNepali Headless') === false) {
            $gh_res = wp_remote_get(self::GITHUB_RAW_URL, array('timeout' => 12, 'sslverify' => true));
            if (!is_wp_error($gh_res) && wp_remote_retrieve_response_code($gh_res) === 200) {
                $gh_body = wp_remote_retrieve_body($gh_res);
                if (strpos($gh_body, 'Plugin Name: TopNepali Headless') !== false) {
                    $body = $gh_body;
                    $code = 200;
                    $url  = self::GITHUB_RAW_URL;
                }
            }
        }

        if (is_wp_error($response) && empty($body)) {
            return array('success' => false, 'message' => 'Network error: ' . $response->get_error_message());
        }

        if ($code !== 200 || empty($body)) {
            return array('success' => false, 'message' => "Download failed with HTTP code {$code}.");
        }

        if (strpos($body, 'Plugin Name: TopNepali Headless') === false) {
            return array('success' => false, 'message' => 'Security check failed: Remote payload is not a valid TopNepali Headless plugin.');
        }

        preg_match('/Version:\s*([0-9\.]+)/i', $body, $ver_matches);
        $new_ver = isset($ver_matches[1]) ? trim($ver_matches[1]) : 'latest';

        $file_path = __FILE__;
        if (!is_writable($file_path)) {
            return array('success' => false, 'message' => "File {$file_path} is write-protected. Please ensure WordPress has write permissions.");
        }

        $written = @file_put_contents($file_path, $body, LOCK_EX);
        if ($written === false) {
            return array('success' => false, 'message' => "Could not write update to {$file_path}.");
        }

        if (function_exists('opcache_invalidate')) {
            @opcache_invalidate($file_path, true);
        }

        delete_transient('topnepali_headless_remote_ver');

        return array(
            'success' => true,
            'version' => $new_ver,
            'message' => "TopNepali Headless updated to version {$new_ver} successfully! ({$written} bytes written from {$url})."
        );
    }

    /**
     * Hook: On Post / Page Save & Publish
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
            // Category archives
            $categories = get_the_category($post_id);
            if (!empty($categories) && !is_wp_error($categories)) {
                foreach ($categories as $cat) {
                    $extra_urls[] = '/category/' . $cat->slug;
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

        $this->dispatch_revalidation($post->post_name, $post->post_type, $update ? 'update' : 'publish', $extra_urls);
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

        $this->dispatch_revalidation($post->post_name, $post->post_type, 'delete', $extra_urls);
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

        // Check persistent post meta cache first (instant microsecond lookup)
        $cached_head = get_post_meta($post_id, '_headless_rm_head', true);
        if (!empty($cached_head)) {
            return $cached_head;
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
            update_post_meta($post_id, '_headless_rm_head', $clean_head);
        }

        return $clean_head;
    }

    /**
     * Get structured Rank Math SEO fields for a post/page
     */
    public function get_rank_math_seo_fields($post_arr) {
        $post_id = is_array($post_arr) ? ($post_arr['id'] ?? 0) : $post_arr;
        if (!$post_id) return null;

        return array(
            'title'          => get_post_meta($post_id, 'rank_math_title', true) ?: null,
            'description'    => get_post_meta($post_id, 'rank_math_description', true) ?: null,
            'canonical_url'  => get_post_meta($post_id, 'rank_math_canonical_url', true) ?: null,
            'focus_keyword'  => get_post_meta($post_id, 'rank_math_focus_keyword', true) ?: null,
            'robots'         => get_post_meta($post_id, 'rank_math_robots', true) ?: null,
            'og_title'       => get_post_meta($post_id, 'rank_math_facebook_title', true) ?: null,
            'og_description' => get_post_meta($post_id, 'rank_math_facebook_description', true) ?: null,
            'og_image'       => get_post_meta($post_id, 'rank_math_facebook_image', true) ?: null,
            'twitter_title'  => get_post_meta($post_id, 'rank_math_twitter_title', true) ?: null,
            'twitter_desc'   => get_post_meta($post_id, 'rank_math_twitter_description', true) ?: null,
            'twitter_image'  => get_post_meta($post_id, 'rank_math_twitter_image', true) ?: null,
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
    }

    /**
     * Render Admin Settings Form
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) return;

        $frontend_url = $this->get_frontend_url();
        $secret = $this->get_secret();
        $rewrite_links = get_option(self::OPTION_REWRITE_LINKS, '1');

        $test_result = null;
        if (isset($_POST['topnepali_test_revalidate']) && check_admin_referer('topnepali_test_action', 'topnepali_test_nonce')) {
            $test_endpoint = $frontend_url . '/api/revalidate';
            $response = wp_remote_post($test_endpoint, array(
                'timeout' => 8,
                'headers' => array(
                    'Content-Type'        => 'application/json',
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
            $recent_posts = get_posts(array(
                'numberposts' => 20,
                'post_status' => 'publish',
                'post_type'   => 'post',
            ));
            $urls = array('/');
            foreach ($recent_posts as $p) {
                $urls[] = '/' . $p->post_name;
            }
            $cats = get_categories(array('number' => 12, 'hide_empty' => true));
            foreach ($cats as $c) {
                $urls[] = '/category/' . $c->slug;
            }
            $urls[] = '/rss.xml';
            $urls[] = '/sitemap.xml';

            $count = $this->warm_cache($urls);
            $warm_result = array(
                'success' => true,
                'count'   => $count,
                'message' => "Successfully triggered background cache warming for {$count} URLs (Homepage, 20 Posts, 12 Categories, RSS, Sitemap) directly on Cloudflare Edge CDN."
            );
        }

        $update_result = null;
        if (isset($_POST['topnepali_self_update']) && check_admin_referer('topnepali_update_action', 'topnepali_update_nonce')) {
            $update_result = $this->perform_in_place_update();
        }

        $remote_version = $this->get_remote_version(true);
        ?>
        <div class="wrap">
            <h1>TopNepali Headless Configuration</h1>
            <p>Connects your WordPress backend with your Astro SSR / Cloudflare Edge frontend for instant cache revalidation and pre-warming.</p>

            <?php if ($update_result): ?>
                <div class="notice notice-<?php echo $update_result['success'] ? 'success' : 'error'; ?> is-dismissible">
                    <p><strong>Plugin Updater:</strong> <?php echo esc_html($update_result['message']); ?></p>
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
                            <p class="description">The public URL of your Astro / Cloudflare Pages site.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="<?php echo esc_attr(self::OPTION_SECRET); ?>">Revalidation Secret Token</label></th>
                        <td>
                            <input
                                name="<?php echo esc_attr(self::OPTION_SECRET); ?>"
                                type="text"
                                id="<?php echo esc_attr(self::OPTION_SECRET); ?>"
                                value="<?php echo esc_attr($secret); ?>"
                                class="regular-text"
                                required
                            />
                            <p class="description">Must match <code>REVALIDATE_SECRET</code> in your Astro <code>.env</code>.</p>
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
                                Rewrite "View Post" and preview buttons in WP Admin to point to the Headless frontend.
                            </label>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Save Headless Settings'); ?>
            </form>

            <hr style="margin: 30px 0;" />

            <h2>Pre-Warm Edge CDN Cache</h2>
            <p>Proactively pre-warms Cloudflare's Global Edge CDN so visitors receive instant sub-100ms responses with zero cold start delays.</p>
            <form method="post" action="">
                <?php wp_nonce_field('topnepali_warm_action', 'topnepali_warm_nonce'); ?>
                <input type="hidden" name="topnepali_warm_recent" value="1" />
                <button type="submit" class="button button-primary">
                    Pre-Warm Frontend Cache (Home, Top 20 Posts & Categories)
                </button>
            </form>

            <hr style="margin: 30px 0;" />

            <h2>Test Revalidation Webhook</h2>
            <p>Send a test ping to your Astro revalidation endpoint to verify network connectivity and token authentication.</p>
            <form method="post" action="">
                <?php wp_nonce_field('topnepali_test_action', 'topnepali_test_nonce'); ?>
                <input type="hidden" name="topnepali_test_revalidate" value="1" />
                <button type="submit" class="button button-secondary">
                    Test Connection to <?php echo esc_html($frontend_url); ?>/api/revalidate
                </button>
            </form>

            <hr style="margin: 30px 0;" />

            <h2>Plugin Self-Updater</h2>
            <p>Directly sync this plugin with the latest code deployed on Cloudflare Edge without manual zipping or file uploads. <strong>100% compatible with Private GitHub repositories.</strong></p>
            <table class="form-table" role="presentation" style="margin-top:0;">
                <tr>
                    <th scope="row">Installed Version</th>
                    <td><code><?php echo esc_html(self::VERSION); ?></code></td>
                </tr>
                <tr>
                    <th scope="row">Update Source</th>
                    <td>
                        <code><?php echo esc_html($this->get_update_endpoint('info')); ?></code>
                        <p class="description">Served directly by your Astro Cloudflare Pages worker. Your GitHub repository can be 100% private.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Latest Available</th>
                    <td>
                        <code><?php echo esc_html($remote_version ?: 'Checking...'); ?></code>
                        <?php if ($remote_version && version_compare(self::VERSION, $remote_version, '<')): ?>
                            <span style="color:#d63638;font-weight:600;margin-left:8px;">New version available!</span>
                        <?php elseif ($remote_version): ?>
                            <span style="color:#00a32a;font-weight:600;margin-left:8px;">Up to date</span>
                        <?php endif; ?>
                    </td>
                </tr>
            </table>
            <form method="post" action="">
                <?php wp_nonce_field('topnepali_update_action', 'topnepali_update_nonce'); ?>
                <input type="hidden" name="topnepali_self_update" value="1" />
                <button type="submit" class="button button-primary">
                    Update Plugin (1-Click Sync)
                </button>
            </form>
        </div>
        <?php
    }
}

// Initialize plugin
new TopNepali_Headless_Plugin();
