<?php
/**
 * Plugin Name: TopNepali Headless
 * Plugin URI: https://topnepali.com
 * Description: High-performance Headless WordPress engine for Astro & Cloudflare Edge. Provides automatic on-demand cache revalidation, preview rewrites, and REST API optimizations.
 * Version: 1.0.0
 * Author: Top Nepali
 * Author URI: https://topnepali.com
 * License: GPL-2.0+
 * Text Domain: topnepali-headless
 */

if (!defined('ABSPATH')) {
    exit;
}

class TopNepali_Headless_Plugin {
    const OPTION_FRONTEND_URL = 'topnepali_headless_frontend_url';
    const OPTION_SECRET = 'topnepali_headless_secret';
    const OPTION_REWRITE_LINKS = 'topnepali_headless_rewrite_links';

    public function __construct() {
        // Lifecycle action hooks
        add_action('save_post', array($this, 'on_save_post'), 10, 3);
        add_action('wp_trash_post', array($this, 'on_trash_post'));
        add_action('untrash_post', array($this, 'on_trash_post'));

        // Admin settings menu
        add_action('admin_menu', array($this, 'register_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));

        // Preview & View link rewrites
        add_filter('post_link', array($this, 'filter_permalink'), 10, 2);
        add_filter('page_link', array($this, 'filter_permalink'), 10, 2);
        add_filter('preview_post_link', array($this, 'filter_preview_link'), 10, 2);

        // REST API enhancements
        add_action('rest_api_init', array($this, 'configure_rest_api'));
    }

    /**
     * Get configured frontend URL
     */
    public function get_frontend_url() {
        $url = get_option(self::OPTION_FRONTEND_URL, 'https://topnepali.com');
        return rtrim(trim($url), '/');
    }

    /**
     * Get configured secret token
     */
    public function get_secret() {
        return get_option(self::OPTION_SECRET, 'topnepali_revalidate_secure_token');
    }

    /**
     * Trigger non-blocking revalidation request to Astro Cloudflare worker
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

        return true;
    }

    /**
     * Hook: On Post / Page Save & Publish
     */
    public function on_save_post($post_id, $post, $update) {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (wp_is_post_revision($post_id)) return;
        if ($post->post_status !== 'publish') return;
        if (!in_array($post->post_type, array('post', 'page'))) return;

        $this->dispatch_revalidation($post->post_name, $post->post_type, $update ? 'update' : 'publish');
    }

    /**
     * Hook: On Trash / Delete Post
     */
    public function on_trash_post($post_id) {
        $post = get_post($post_id);
        if (!$post) return;
        $this->dispatch_revalidation($post->post_name, $post->post_type, 'delete');
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
     * REST API Security: Block unauthenticated user enumeration
     */
    public function configure_rest_api() {
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
        ?>
        <div class="wrap">
            <h1>TopNepali Headless Configuration</h1>
            <p>Connects your WordPress backend with your Astro SSR / Cloudflare Edge frontend for instant cache revalidation.</p>

            <?php if ($test_result): ?>
                <div class="notice notice-<?php echo $test_result['success'] ? 'success' : 'error'; ?> is-dismissible">
                    <p><strong>Connection Test Result (Status: <?php echo esc_html($test_result['code'] ?? 'Error'); ?>):</strong></p>
                    <pre style="background:#fff;padding:8px;border-radius:4px;"><?php echo esc_html($test_result['message']); ?></pre>
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

            <h2>Test Revalidation Webhook</h2>
            <p>Send a real test ping to your Astro revalidation endpoint to verify network connectivity and token authentication.</p>
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
}

// Initialize plugin
new TopNepali_Headless_Plugin();
