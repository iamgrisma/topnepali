<?php
/**
 * TopNepali Headless — Automatic On-Demand Cache Invalidation Webhook
 *
 * Paste this snippet into your child theme functions.php or in a Code Snippets plugin.
 * Whenever an article or page is published, updated, or trashed in WordPress,
 * this notifies your Astro Cloudflare edge worker to immediately purge the cache.
 */

// Define your secret token (must match REVALIDATE_SECRET in your Astro .env / Cloudflare env vars)
define('TOPNEPALI_REVALIDATE_SECRET', 'topnepali_revalidate_secure_token');

// Define your Astro Frontend URL
define('TOPNEPALI_FRONTEND_URL', 'https://topnepali.com');

function topnepali_notify_cache_revalidation($post_id, $post, $update) {
    // Ignore autosaves, revisions, or drafts
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;
    if ($post->post_status !== 'publish') return;

    // Only handle standard posts and pages
    if (!in_array($post->post_type, array('post', 'page'))) return;

    $endpoint = rtrim(TOPNEPALI_FRONTEND_URL, '/') . '/api/revalidate';

    $payload = array(
        'slug'   => $post->post_name,
        'type'   => $post->post_type,
        'action' => $update ? 'update' : 'publish',
        'id'     => $post_id,
    );

    // Non-blocking asynchronous POST request — does not slow down WordPress admin!
    wp_remote_post($endpoint, array(
        'method'      => 'POST',
        'timeout'     => 3,
        'blocking'    => false, // Asynchronous fire-and-forget
        'headers'     => array(
            'Content-Type'         => 'application/json',
            'x-revalidate-secret'  => TOPNEPALI_REVALIDATE_SECRET,
        ),
        'body'        => wp_json_encode($payload),
        'data_format' => 'body',
    ));
}
add_action('save_post', 'topnepali_notify_cache_revalidation', 10, 3);

function topnepali_notify_cache_on_trash($post_id) {
    $post = get_post($post_id);
    if (!$post) return;

    $endpoint = rtrim(TOPNEPALI_FRONTEND_URL, '/') . '/api/revalidate';
    $payload = array(
        'slug'   => $post->post_name,
        'type'   => $post->post_type,
        'action' => 'delete',
        'id'     => $post_id,
    );

    wp_remote_post($endpoint, array(
        'method'      => 'POST',
        'timeout'     => 3,
        'blocking'    => false,
        'headers'     => array(
            'Content-Type'         => 'application/json',
            'x-revalidate-secret'  => TOPNEPALI_REVALIDATE_SECRET,
        ),
        'body'        => wp_json_encode($payload),
        'data_format' => 'body',
    ));
}
add_action('wp_trash_post', 'topnepali_notify_cache_on_trash');
