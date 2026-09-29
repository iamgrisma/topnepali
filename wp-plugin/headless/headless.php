<?php
/**
 * Plugin Name: TopNepali Headless Engine
 * Plugin URI: https://topnepali.com
 * Description: High-performance Headless WordPress engine for Astro & Cloudflare Edge. Provides automatic on-demand cache revalidation, preview rewrites, Rank Math head bridge, and REST API edge caching.
 * Version: 1.3.1
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
    const VERSION = '1.3.1';

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

            // Native WordPress Core Plugin Update Hooks
            add_filter('pre_set_site_transient_update_plugins', array($this, 'check_for_update'));
            add_filter('plugins_api', array($this, 'plugin_popup_info'), 20, 3);
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

        $update_check_result = null;
        if (isset($_POST['topnepali_check_updates']) && check_admin_referer('topnepali_update_action', 'topnepali_update_nonce')) {
            delete_transient('topnepali_headless_update_info');
            delete_site_transient('update_plugins');
            $remote = $this->get_remote_info(true);
            if ($remote && !empty($remote['version'])) {
                $has_update = version_compare(self::VERSION, $remote['version'], '<');
                $update_check_result = array(
                    'success'    => true,
                    'has_update' => $has_update,
                    'version'    => $remote['version'],
                    'message'    => $has_update
                        ? "New update available: v{$remote['version']} (Current: v" . self::VERSION . "). You can update now from the WordPress Updates screen or Plugins page."
                        : "Plugin is up to date (v" . self::VERSION . ").",
                );
            } else {
                $update_check_result = array(
                    'success' => false,
                    'message' => 'Failed to reach Astro update server. Please verify your Frontend URL and Secret Token.',
                );
            }
        }

        ?>
        <div class="wrap">
            <h1>TopNepali Headless Configuration</h1>
            <p>Connects your WordPress backend with your Astro SSR / Cloudflare Edge frontend for instant cache revalidation and pre-warming.</p>

            <?php if ($update_check_result): ?>
                <div class="notice notice-<?php echo $update_check_result['success'] ? ($update_check_result['has_update'] ? 'warning' : 'success') : 'error'; ?> is-dismissible">
                    <p><strong>Plugin Update Status:</strong> <?php echo esc_html($update_check_result['message']); ?></p>
                    <?php if (!empty($update_check_result['has_update'])): ?>
                        <p><a href="<?php echo esc_url(admin_url('update-core.php')); ?>" class="button button-primary">Go to WordPress Updates</a></p>
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

            <h2>Plugin Updates (Native WordPress Upgrader)</h2>
            <p>Installed Version: <strong>v<?php echo esc_html(self::VERSION); ?></strong></p>
            <p>Updates are delivered safely as standard zip archives via WordPress core's native upgrader with zero raw file write risks.</p>
            <form method="post" action="">
                <?php wp_nonce_field('topnepali_update_action', 'topnepali_update_nonce'); ?>
                <input type="hidden" name="topnepali_check_updates" value="1" />
                <button type="submit" class="button button-secondary">
                    Check for Plugin Updates Now
                </button>
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
            'description' => 'High-performance Headless WordPress engine for Astro & Cloudflare Edge.',
            'changelog'   => 'Native WordPress update pipeline.',
        );

        return $res;
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
                'Accept'     => 'application/json',
                'User-Agent' => 'TopNepali-WP-NativeUpdater/' . self::VERSION . '; ' . home_url(),
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
