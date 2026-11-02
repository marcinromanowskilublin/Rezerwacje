<?php
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Password');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/backup-bookings.php';
require_once __DIR__ . '/visit-report.php';

$api_route = api_route();

if (
    strpos($api_route, '/backups/bookings') !== 0
    && strpos($api_route, '/admin/backups/bookings') !== 0
) {
    backup_bookings_maybe_run_silent();
    visit_report_maybe_run_silent();
}

if ($api_route === '/site' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    json_response(['schedule_enabled' => schedule_enabled()]);
}

if (visit_report_handle_route($api_route, $_SERVER['REQUEST_METHOD'] ?? 'GET')) {
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
    || $api_route === '/admin/login'
) {
    require __DIR__ . '/bookings.php';
    return;
}

json_response(['error' => 'Not found'], 404);
