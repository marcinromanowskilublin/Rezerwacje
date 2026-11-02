<?php
declare(strict_types=1);

$configPath = dirname(__DIR__) . '/config/config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Brak pliku config.php. Skopiuj config.example.php.']);
    exit;
}

require $configPath;

function json_response($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_input(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function api_route(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $route = preg_replace('#^.*?/api#', '', $path);
    $route = '/' . trim((string) $route, '/');
    return $route === '/' ? '/' : (rtrim($route, '/') ?: '/');
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $config;
    $pdo = new PDO(
        'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=' . $config['db_charset'],
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    return $pdo;
}

function require_admin(): void
{
    global $config;
    $expected = (string) ($config['admin_password'] ?? '');
    $given = (string) ($_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '');

    if ($expected === '' || $given === '' || !hash_equals($expected, $given)) {
        json_response(['error' => 'Unauthorized'], 401);
    }
}

function hm(string $time): string
{
    return substr($time, 0, 5);
}

function minutes(string $time): int
{
    $parts = explode(':', hm($time));
    return ((int) $parts[0]) * 60 + ((int) ($parts[1] ?? 0));
}

function from_minutes(int $total): string
{
    $total = max(0, $total);
    return sprintf('%02d:%02d', intdiv($total, 60) % 24, $total % 60);
}

function normalize_booking(array $row): array
{
    if (isset($row['start_time'])) {
        $row['start_time'] = hm((string) $row['start_time']);
    }
    if (isset($row['end_time'])) {
        $row['end_time'] = hm((string) $row['end_time']);
    }
    if (isset($row['active'])) {
        $row['active'] = (bool) $row['active'];
    }
    if (isset($row['price'])) {
        $row['price'] = (float) $row['price'];
    }
    if (isset($row['duration_minutes'])) {
        $row['duration_minutes'] = (int) $row['duration_minutes'];
    }
    if (isset($row['day_of_week'])) {
        $row['day_of_week'] = (int) $row['day_of_week'];
    }
    if (isset($row['slot_duration'])) {
        $row['slot_duration'] = (int) $row['slot_duration'];
    }
    if (isset($row['buffer_minutes'])) {
        $row['buffer_minutes'] = (int) $row['buffer_minutes'];
    }
    if (!isset($row['audience']) || $row['audience'] === '') {
        $row['audience'] = 'all';
    }
    if (!isset($row['kind']) || $row['kind'] === '') {
        $row['kind'] = (($row['id'] ?? '') === 'vt_2') ? 'followup' : 'first';
    }
    return $row;
}

function schedule_enabled(): bool
{
    global $config;
    if (!is_array($config) || !array_key_exists('schedule_enabled', $config)) {
        return true;
    }
    return (bool) $config['schedule_enabled'];
}

function public_app_url(string $path): string
{
    global $config;
    $configured = trim((string) ($config['public_base_url'] ?? ''));
    if ($configured !== '') {
        $base = rtrim($configured, '/');
    } else {
        $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $base = ($https ? 'https' : 'http') . '://' . $host;
    }
    $app = rtrim((string) ($config['app_base_path'] ?? '/'), '/');
    return $base . $app . '/' . ltrim($path, '/');
}

function ranges_overlap(int $aStart, int $aEnd, int $bStart, int $bEnd): bool
{
    return $aStart < $bEnd && $bStart < $aEnd;
}

function visit_type(PDO $pdo, string $id, bool $activeOnly = true): ?array
{
    $sql = $activeOnly
        ? 'SELECT * FROM visit_types WHERE id = ? AND active = 1'
        : 'SELECT * FROM visit_types WHERE id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? normalize_booking($row) : null;
}

function rule_matches_visit(array $rule, array $visitType): bool
{
    $audience = (string) ($rule['audience'] ?? 'all');
    if ($audience === '' || $audience === 'all') {
        return true;
    }
    $kind = (string) ($visitType['kind'] ?? '');
    if ($kind === '') {
        $kind = (($visitType['id'] ?? '') === 'vt_2') ? 'followup' : 'first';
    }
    return $audience === $kind;
}

function occupied_ranges(PDO $pdo, string $date, ?string $excludeBookingId = null): array
{
    $ranges = [];

    $sql = "SELECT b.id, b.start_time, b.end_time, v.duration_minutes
         FROM bookings b
         LEFT JOIN visit_types v ON v.id = b.visit_type_id
         WHERE b.booking_date = ? AND b.status != 'cancelled'";
    $params = [$date];
    if ($excludeBookingId) {
        $sql .= ' AND b.id != ?';
        $params[] = $excludeBookingId;
    }
    $booked = $pdo->prepare($sql);
    $booked->execute($params);
    foreach ($booked as $row) {
        $start = minutes((string) $row['start_time']);
        $endTime = (string) $row['end_time'];
        $duration = (int) ($row['duration_minutes'] ?? 30);
        $end = ($endTime !== '' && hm($endTime) !== hm((string) $row['start_time']))
            ? minutes($endTime)
            : $start + max(1, $duration);
        $ranges[] = [$start, $end];
    }

    $blocked = $pdo->prepare('SELECT start_time, end_time FROM blocked_periods WHERE date = ?');
    $blocked->execute([$date]);
    foreach ($blocked as $row) {
        $ranges[] = [minutes((string) $row['start_time']), minutes((string) $row['end_time'])];
    }

    return $ranges;
}

function available_slots(PDO $pdo, string $date, array $visitType, ?string $excludeBookingId = null): array
{
    $dayOfWeek = (int) date('w', strtotime($date . ' 12:00:00'));
    $stmt = $pdo->prepare('SELECT * FROM availability_rules WHERE day_of_week = ?');
    $stmt->execute([$dayOfWeek]);
    $rules = $stmt->fetchAll();
    if (!$rules) {
        return [];
    }

    $duration = (int) $visitType['duration_minutes'];
    $occupied = occupied_ranges($pdo, $date, $excludeBookingId);
    $today = date('Y-m-d');
    $nowMinutes = ((int) date('H')) * 60 + (int) date('i');
    $found = [];

    foreach ($rules as $rule) {
        $rule = normalize_booking($rule);
        if (!rule_matches_visit($rule, $visitType)) {
            continue;
        }
        $step = max(5, (int) ($rule['slot_duration'] ?? $duration));
        $start = minutes((string) $rule['start_time']);
        $end = minutes((string) $rule['end_time']);
        for ($cursor = $start; $cursor + $duration <= $end; $cursor += $step) {
            if ($date === $today && $cursor <= $nowMinutes) {
                continue;
            }
            $slotEnd = $cursor + $duration;
            $busy = false;
            foreach ($occupied as [$bStart, $bEnd]) {
                if (ranges_overlap($cursor, $slotEnd, $bStart, $bEnd)) {
                    $busy = true;
                    break;
                }
            }
            if (!$busy) {
                $found[from_minutes($cursor)] = true;
            }
        }
    }

    $slots = array_keys($found);
    sort($slots);
    return $slots;
}
