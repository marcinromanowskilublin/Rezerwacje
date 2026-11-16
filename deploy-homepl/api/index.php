<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
apply_api_cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/backup-bookings.php';
require_once __DIR__ . '/visit-report.php';
require_once __DIR__ . '/smsapi.php';
require_once __DIR__ . '/payments.php';
require_once __DIR__ . '/whatsapp.php';
require_once __DIR__ . '/contact-center.php';
require_once __DIR__ . '/contact-form.php';
require_once __DIR__ . '/psychiatric-form.php';
require_once __DIR__ . '/mydr.php';

$api_route = api_route();
$api_method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($api_route === '/admin/login' && $api_method === 'POST') {
    $data = json_input();
    json_response(admin_session_login(
        (string) ($data['login'] ?? ''),
        (string) ($data['password'] ?? '')
    ));
}

if ($api_route === '/admin/session' && $api_method === 'GET') {
    json_response(admin_session_status());
}

if ($api_route === '/admin/logout' && $api_method === 'POST') {
    require_admin();
    admin_session_logout();
    json_response(['ok' => true]);
}

if ($api_route === '/whatsapp/webhook') {
    whatsapp_handle_webhook($api_method);
}

if ($api_route === '/whatsapp/cleanup') {
    whatsapp_handle_cleanup_route($api_method);
}

if ($api_route === '/whatsapp/bot/run') {
    whatsapp_handle_bot_run_route($api_method);
}

if ($api_route === '/smsapi/callback') {
    smsapi_handle_callback($api_method);
    return;
}

if ($api_route === '/smsapi/reminders/run') {
    smsapi_handle_reminders_route($api_method);
    return;
}

if (payment_handle_route($api_route, $api_method)) {
    return;
}

whatsapp_cleanup_maybe_run_silent();

if (
    strpos($api_route, '/backups/bookings') !== 0
    && strpos($api_route, '/admin/backups/bookings') !== 0
) {
    backup_bookings_maybe_run_silent();
    visit_report_maybe_run_silent();
    mydr_retry_maybe_run_silent();
}

if ($api_route === '/site' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    json_response(['schedule_enabled' => schedule_enabled()]);
}

if ($api_route === '/contact-form') {
    contact_form_handle($api_method);
}

if ($api_route === '/psychiatric-form') {
    psychiatric_form_handle($api_method);
}

if (visit_report_handle_route($api_route, $_SERVER['REQUEST_METHOD'] ?? 'GET')) {
    return;
}

if (whatsapp_handle_admin_route($api_route, $api_method)) {
    return;
}

if (contact_center_handle_route($api_route, $api_method)) {
    return;
}

if (mydr_handle_admin_route($api_route, $api_method)) {
    return;
}

if ($api_route === '/visit-types' || strpos($api_route, '/admin/visit-types') === 0) {
    require __DIR__ . '/visit-types.php';
    return;
}

if (strpos($api_route, '/availability') === 0 || strpos($api_route, '/admin/availability') === 0) {
    require __DIR__ . '/availability.php';
    return;
}

if ($api_route === '/analytics/view' || $api_route === '/admin/analytics') {
    require __DIR__ . '/analytics.php';
    return;
}

if (strpos($api_route, '/backups/bookings') === 0 || strpos($api_route, '/admin/backups/bookings') === 0) {
    require __DIR__ . '/backups.php';
    return;
}

if (
    strpos($api_route, '/bookings') === 0
    || strpos($api_route, '/admin/bookings') === 0
    || strpos($api_route, '/admin/whatsapp') === 0
    || strpos($api_route, '/admin/sms') === 0
    || strpos($api_route, '/admin/payments') === 0
) {
    require __DIR__ . '/bookings.php';
    return;
}

json_response(['error' => 'Not found'], 404);
