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

function request_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }
    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function apply_api_cors(): void
{
    global $config;

    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') {
        return;
    }

    $allowed = $config['cors_allowed_origins'] ?? [];
    if (!is_array($allowed)) {
        $allowed = [];
    }
    $publicBase = rtrim((string) ($config['public_base_url'] ?? ''), '/');
    if ($publicBase !== '') {
        $allowed[] = $publicBase;
    }
    $allowed = array_values(array_unique(array_filter(array_map(
        static fn($value): string => rtrim(trim((string) $value), '/'),
        $allowed
    ))));

    if (!in_array(rtrim($origin, '/'), $allowed, true)) {
        return;
    }

    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Vary: Origin');
}

function secure_runtime_dir(string $purpose): string
{
    global $config;
    $base = rtrim(sys_get_temp_dir(), "/\\");
    $namespace = substr(hash(
        'sha256',
        __DIR__ . '|' . (string) ($config['admin_password'] ?? '') . '|' . $purpose
    ), 0, 20);
    $dir = $base . DIRECTORY_SEPARATOR . 'mr-' . preg_replace('/[^a-z0-9-]/', '', strtolower($purpose))
        . '-' . $namespace;
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        json_response(['error' => 'Nie udało się przygotować bezpiecznego magazynu.'], 500);
    }
    @chmod($dir, 0700);
    return $dir;
}

function request_client_ip(): string
{
    $ip = trim((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    return filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : 'unknown';
}

function rate_limit_path(string $bucket): string
{
    $key = hash('sha256', $bucket . '|' . request_client_ip());
    return secure_runtime_dir('rate-limits') . DIRECTORY_SEPARATOR . $key . '.json';
}

function rate_limit_consume(string $bucket, int $limit, int $windowSeconds): array
{
    $limit = max(1, $limit);
    $windowSeconds = max(1, $windowSeconds);
    $path = rate_limit_path($bucket);
    $handle = fopen($path, 'c+');
    if ($handle === false) {
        return ['allowed' => false, 'retry_after' => $windowSeconds];
    }
    @chmod($path, 0600);
    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        return ['allowed' => false, 'retry_after' => $windowSeconds];
    }

    $raw = stream_get_contents($handle);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    $now = time();
    $cutoff = $now - $windowSeconds;
    $attempts = [];
    foreach (is_array($decoded) ? $decoded : [] as $timestamp) {
        $value = (int) $timestamp;
        if ($value > $cutoff && $value <= $now) {
            $attempts[] = $value;
        }
    }

    $allowed = count($attempts) < $limit;
    if ($allowed) {
        $attempts[] = $now;
    }
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($attempts));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    $retryAfter = $allowed || $attempts === []
        ? 0
        : max(1, $windowSeconds - ($now - min($attempts)));
    return ['allowed' => $allowed, 'retry_after' => $retryAfter];
}

function rate_limit_clear(string $bucket): void
{
    $path = rate_limit_path($bucket);
    if (is_file($path)) {
        @unlink($path);
    }
}

function admin_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    global $config;
    $sessionDir = trim((string) ($config['admin_session_dir'] ?? ''));
    if ($sessionDir === '') {
        $sessionDir = secure_runtime_dir('admin-sessions');
    }
    if (!is_dir($sessionDir) && !mkdir($sessionDir, 0700, true) && !is_dir($sessionDir)) {
        json_response(['error' => 'Nie udało się uruchomić bezpiecznej sesji.'], 500);
    }
    if (!is_writable($sessionDir)) {
        json_response(['error' => 'Magazyn sesji nie jest zapisywalny.'], 500);
    }
    $protection = "Deny from all\n";
    foreach ([dirname($sessionDir) . '/.htaccess', $sessionDir . '/.htaccess'] as $path) {
        if (!is_file($path)) {
            @file_put_contents($path, $protection, LOCK_EX);
        }
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set(
        'session.gc_maxlifetime',
        (string) max(300, (int) ($config['admin_session_idle_seconds'] ?? 3600))
    );
    session_save_path($sessionDir);

    $cookieName = trim((string) ($config['admin_session_cookie'] ?? 'mr_admin_session'));
    if ($cookieName === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $cookieName)) {
        $cookieName = 'mr_admin_session';
    }

    session_name($cookieName);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (bool) ($config['admin_session_secure'] ?? true),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function admin_session_refresh_cookie(): void
{
    if (!ini_get('session.use_cookies') || session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $params = session_get_cookie_params();
    setcookie(session_name(), session_id(), [
        'expires' => 0,
        'path' => $params['path'] ?: '/',
        'domain' => $params['domain'] ?? '',
        'secure' => (bool) ($params['secure'] ?? request_is_https()),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function admin_password_matches(string $given): bool
{
    global $config;
    $expected = (string) ($config['admin_password'] ?? '');
    if ($expected === '' || $given === '') {
        return false;
    }
    $hashInfo = password_get_info($expected);
    if (!empty($hashInfo['algo'])) {
        return password_verify($given, $expected);
    }
    return hash_equals($expected, $given);
}

function admin_session_login(string $login, string $password): array
{
    global $config;
    $bucket = 'admin-login';
    $rate = rate_limit_consume(
        $bucket,
        max(3, (int) ($config['admin_login_rate_limit'] ?? 10)),
        max(60, (int) ($config['admin_login_rate_window_seconds'] ?? 900))
    );
    if (empty($rate['allowed'])) {
        header('Retry-After: ' . (int) ($rate['retry_after'] ?? 60));
        json_response(['error' => 'Zbyt wiele prób logowania. Spróbuj ponownie później.'], 429);
    }

    $expectedLogin = strtolower(trim((string) ($config['admin_login'] ?? 'admin')));
    if ($expectedLogin === '') {
        $expectedLogin = 'admin';
    }
    if (strtolower(trim($login)) !== $expectedLogin || !admin_password_matches($password)) {
        usleep(250000);
        json_response(['error' => 'Unauthorized'], 401);
    }
    rate_limit_clear($bucket);

    admin_session_start();
    session_regenerate_id(true);
    // Na części hostingów współdzielonych samo session_regenerate_id() nie
    // wysyła ponownie ciasteczka, jeśli sesja została otwarta we wcześniejszym żądaniu.
    admin_session_refresh_cookie();
    $_SESSION['admin_authenticated'] = true;
    $_SESSION['admin_last_seen'] = time();
    $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
    $csrf = (string) $_SESSION['admin_csrf'];
    // Zapisz sesję przed wysłaniem odpowiedzi. Na hostingu współdzielonym
    // kolejne żądanie może trafić do innego procesu PHP natychmiast po logowaniu.
    session_write_close();

    return [
        'authenticated' => true,
        'csrf_token' => $csrf,
    ];
}

function admin_session_is_authenticated(): bool
{
    global $config;
    admin_session_start();

    if (empty($_SESSION['admin_authenticated'])) {
        return false;
    }
    $lastSeen = (int) ($_SESSION['admin_last_seen'] ?? 0);
    $idleSeconds = max(300, (int) ($config['admin_session_idle_seconds'] ?? 3600));
    if ($lastSeen <= 0 || time() - $lastSeen > $idleSeconds) {
        $_SESSION = [];
        return false;
    }
    $_SESSION['admin_last_seen'] = time();
    if (empty($_SESSION['admin_csrf'])) {
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
    }
    return true;
}

function admin_session_status(): array
{
    if (!admin_session_is_authenticated()) {
        return ['authenticated' => false];
    }
    return [
        'authenticated' => true,
        'csrf_token' => (string) $_SESSION['admin_csrf'],
    ];
}

function admin_session_logout(): void
{
    admin_session_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?: '/',
            'domain' => $params['domain'] ?? '',
            'secure' => (bool) ($params['secure'] ?? false),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
    session_destroy();
}

function require_admin_csrf(): void
{
    $expected = (string) ($_SESSION['admin_csrf'] ?? '');
    $given = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $given === '' || !hash_equals($expected, $given)) {
        json_response(['error' => 'Invalid CSRF token'], 403);
    }
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
    if (!admin_session_is_authenticated()) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        require_admin_csrf();
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
