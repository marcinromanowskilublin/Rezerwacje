<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/backup-bookings.php';

$route = $api_route ?? api_route();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = db();

    if ($route === '/admin/backups/bookings/status' && $method === 'GET') {
        require_admin();
        json_response(backup_bookings_status());
    }

    if ($route === '/admin/backups/bookings/run' && in_array($method, ['GET', 'POST'], true)) {
        if (!backup_bookings_secret_matches()) {
            require_admin();
        }
        json_response(backup_bookings_run($pdo, true));
    }

    if ($route === '/backups/bookings/run' && in_array($method, ['GET', 'POST'], true)) {
        if (!backup_bookings_secret_matches()) {
            json_response(['error' => 'Unauthorized'], 401);
        }
        json_response(backup_bookings_run($pdo, true));
    }

    json_response(['error' => 'Not found'], 404);
} catch (PDOException $e) {
    json_response(['error' => 'Database error'], 500);
} catch (RuntimeException $e) {
    json_response(['error' => 'Backup error'], 500);
}
