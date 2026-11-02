<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$route = $api_route ?? api_route();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function analytics_is_obvious_bot(): bool
{
    $userAgent = strtolower((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if ($userAgent === '') {
        return false;
    }

    return (bool) preg_match(
        '/bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|curl|wget|headless|lighthouse|pagespeed|google-inspectiontool/',
        $userAgent
    );
}

function analytics_client_ip(): string
{
    $candidates = [
        (string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''),
        (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''),
        (string) ($_SERVER['HTTP_X_REAL_IP'] ?? ''),
        (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
    ];

    foreach ($candidates as $candidate) {
        if ($candidate === '') {
            continue;
        }

        $parts = array_map('trim', explode(',', $candidate));
        foreach ($parts as $part) {
            if ($part !== '' && filter_var($part, FILTER_VALIDATE_IP)) {
                return $part;
            }
        }
    }

    return '';
}

function analytics_excluded_ips(): array
{
    global $config;
    $raw = $config['analytics_excluded_ips'] ?? [];

    if (is_string($raw)) {
        $raw = preg_split('/[\s,;]+/', $raw, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }
    if (!is_array($raw)) {
        return [];
    }

    $valid = [];
    foreach ($raw as $value) {
        $ip = trim((string) $value);
        if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
            $valid[$ip] = true;
        }
    }

    return array_keys($valid);
}

function analytics_is_excluded_ip(): bool
{
    $clientIp = analytics_client_ip();
    if ($clientIp === '') {
        return false;
    }

    foreach (analytics_excluded_ips() as $excludedIp) {
        if (hash_equals($excludedIp, $clientIp)) {
            return true;
        }
    }

    return false;
}

function analytics_is_same_site_request(): bool
{
    $fetchSite = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    if ($fetchSite === 'cross-site') {
        return false;
    }

    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') {
        return true;
    }

    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $requestHost = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));

    return $originHost !== '' && $originHost === $requestHost;
}

function analytics_today(): string
{
    $now = new DateTimeImmutable('now', new DateTimeZone('Europe/Warsaw'));
    return $now->format('Y-m-d');
}

try {
    $pdo = db();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS page_views_daily (
            view_date date NOT NULL,
            view_count bigint unsigned NOT NULL DEFAULT 0,
            PRIMARY KEY (view_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    if ($route === '/analytics/view' && $method === 'POST') {
        if (!analytics_is_same_site_request()) {
            json_response(['error' => 'Forbidden'], 403);
        }

        if (!analytics_is_obvious_bot() && !analytics_is_excluded_ip()) {
            $stmt = $pdo->prepare(
                'INSERT INTO page_views_daily (view_date, view_count)
                 VALUES (?, 1)
                 ON DUPLICATE KEY UPDATE view_count = view_count + 1'
            );
            $stmt->execute([analytics_today()]);
        }

        json_response(['ok' => true]);
    }

    if ($route === '/admin/analytics' && $method === 'GET') {
        require_admin();

        $timezone = new DateTimeZone('Europe/Warsaw');
        $today = new DateTimeImmutable('today', $timezone);
        $from = $today->modify('-29 days')->format('Y-m-d');

        $total = (int) $pdo->query(
            'SELECT COALESCE(SUM(view_count), 0) FROM page_views_daily'
        )->fetchColumn();

        $stmt = $pdo->prepare(
            'SELECT view_date, view_count
             FROM page_views_daily
             WHERE view_date >= ?
             ORDER BY view_date ASC'
        );
        $stmt->execute([$from]);

        $counts = [];
        foreach ($stmt->fetchAll() as $row) {
            $counts[(string) $row['view_date']] = (int) $row['view_count'];
        }

        $days = [];
        for ($offset = 29; $offset >= 0; $offset--) {
            $date = $today->modify("-{$offset} days")->format('Y-m-d');
            $days[] = [
                'date' => $date,
                'count' => $counts[$date] ?? 0,
            ];
        }

        $todayDate = $today->format('Y-m-d');
        json_response([
            'total' => $total,
            'today' => $counts[$todayDate] ?? 0,
            'days' => $days,
        ]);
    }

    json_response(['error' => 'Not found'], 404);
} catch (PDOException $e) {
    json_response(['error' => 'Database error'], 500);
}
