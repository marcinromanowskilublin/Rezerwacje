<?php
declare(strict_types=1);

function backup_bookings_interval_seconds(): int
{
    global $config;
    $configured = (int) ($config['bookings_backup_interval_seconds'] ?? 21600);
    return max(900, $configured);
}

function backup_bookings_retention_days(): int
{
    global $config;
    $configured = (int) ($config['bookings_backup_retention_days'] ?? 30);
    return max(1, $configured);
}

function backup_bookings_storage_dir(): string
{
    global $config;
    $configured = trim((string) ($config['bookings_backup_dir'] ?? ''));
    if ($configured !== '') {
        return rtrim($configured, "/\\");
    }

    return dirname(__DIR__) . '/storage/bookings-backups';
}

function backup_bookings_state_path(): string
{
    return backup_bookings_storage_dir() . '/_last_backup.json';
}

function backup_bookings_ensure_storage(): string
{
    $dir = backup_bookings_storage_dir();
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Nie udało się utworzyć katalogu backupu.');
    }

    $protection = "Deny from all\n";
    $protectPaths = [
        dirname($dir) . '/.htaccess',
        $dir . '/.htaccess',
    ];
    foreach ($protectPaths as $path) {
        if (!is_file($path)) {
            @file_put_contents($path, $protection, LOCK_EX);
        }
    }

    return $dir;
}

function backup_bookings_read_state(): array
{
    $statePath = backup_bookings_state_path();
    if (!is_file($statePath)) {
        return [
            'last_run_at' => null,
            'last_file' => null,
            'last_count' => 0,
            'last_size_bytes' => 0,
        ];
    }

    $raw = file_get_contents($statePath);
    if ($raw === false || trim($raw) === '') {
        return [
            'last_run_at' => null,
            'last_file' => null,
            'last_count' => 0,
            'last_size_bytes' => 0,
        ];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [
            'last_run_at' => null,
            'last_file' => null,
            'last_count' => 0,
            'last_size_bytes' => 0,
        ];
    }

    return [
        'last_run_at' => isset($decoded['last_run_at']) ? (string) $decoded['last_run_at'] : null,
        'last_file' => isset($decoded['last_file']) ? (string) $decoded['last_file'] : null,
        'last_count' => (int) ($decoded['last_count'] ?? 0),
        'last_size_bytes' => (int) ($decoded['last_size_bytes'] ?? 0),
    ];
}

function backup_bookings_write_state(array $state): void
{
    $dir = backup_bookings_ensure_storage();
    $path = $dir . '/_last_backup.json';
    $encoded = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($encoded === false || file_put_contents($path, $encoded, LOCK_EX) === false) {
        throw new RuntimeException('Nie udało się zapisać stanu backupu.');
    }
    @chmod($path, 0600);
}

function backup_bookings_status(): array
{
    $state = backup_bookings_read_state();
    $interval = backup_bookings_interval_seconds();
    $lastTs = null;

    if (is_string($state['last_run_at']) && $state['last_run_at'] !== '') {
        $parsed = strtotime($state['last_run_at']);
        if ($parsed !== false) {
            $lastTs = $parsed;
        }
    }

    $nextDueAt = null;
    $secondsUntilNext = 0;
    if ($lastTs !== null) {
        $nextTs = $lastTs + $interval;
        $secondsUntilNext = max(0, $nextTs - time());
        $nextDueAt = gmdate('c', $nextTs);
    }

    return [
        'interval_seconds' => $interval,
        'retention_days' => backup_bookings_retention_days(),
        'last_run_at' => $state['last_run_at'],
        'last_file' => $state['last_file'],
        'last_count' => $state['last_count'],
        'last_size_bytes' => $state['last_size_bytes'],
        'next_due_at' => $nextDueAt,
        'seconds_until_next' => $secondsUntilNext,
    ];
}

function backup_bookings_cleanup_old_files(): void
{
    $dir = backup_bookings_ensure_storage();
    $retentionDays = backup_bookings_retention_days();
    $threshold = time() - ($retentionDays * 86400);

    $files = glob($dir . '/bookings_*.json') ?: [];
    foreach ($files as $file) {
        $mtime = @filemtime($file);
        if ($mtime === false) {
            continue;
        }
        if ($mtime < $threshold) {
            @unlink($file);
        }
    }
}

function backup_bookings_secret_matches(): bool
{
    global $config;
    $expected = trim((string) ($config['bookings_backup_token'] ?? ''));
    if ($expected === '') {
        return false;
    }

    $given = (string) ($_GET['token'] ?? '');
    if ($given === '') {
        $given = (string) ($_POST['token'] ?? '');
    }
    if ($given === '') {
        $given = (string) ($_SERVER['HTTP_X_BACKUP_TOKEN'] ?? '');
    }

    return $given !== '' && hash_equals($expected, $given);
}

function backup_bookings_create_snapshot(PDO $pdo): array
{
    $dir = backup_bookings_ensure_storage();

    $stmt = $pdo->query('SELECT * FROM bookings ORDER BY booking_date ASC, start_time ASC, id ASC');
    $rows = $stmt->fetchAll();

    $now = new DateTimeImmutable('now', new DateTimeZone('Europe/Warsaw'));
    $fileName = 'bookings_' . $now->format('Ymd_His') . '.json';
    $path = $dir . '/' . $fileName;

    $payload = [
        'generated_at' => $now->format(DateTimeInterface::ATOM),
        'timezone' => 'Europe/Warsaw',
        'count' => count($rows),
        'bookings' => $rows,
    ];

    $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($encoded === false || file_put_contents($path, $encoded, LOCK_EX) === false) {
        throw new RuntimeException('Nie udało się zapisać pliku backupu.');
    }
    @chmod($path, 0600);

    $size = (int) (@filesize($path) ?: 0);
    backup_bookings_write_state([
        'last_run_at' => $now->format(DateTimeInterface::ATOM),
        'last_file' => $fileName,
        'last_count' => count($rows),
        'last_size_bytes' => $size,
    ]);
    backup_bookings_cleanup_old_files();

    return [
        'created' => true,
        'last_run_at' => $now->format(DateTimeInterface::ATOM),
        'last_file' => $fileName,
        'last_count' => count($rows),
        'last_size_bytes' => $size,
    ];
}

function backup_bookings_run(PDO $pdo, bool $force = false): array
{
    if (!$force) {
        $status = backup_bookings_status();
        if ($status['seconds_until_next'] > 0) {
            return ['created' => false, 'reason' => 'interval_not_elapsed'] + $status;
        }
    }

    $lockName = 'rez_bookings_backup';
    $lock = $pdo->prepare('SELECT GET_LOCK(?, 5)');
    $lock->execute([$lockName]);
    if ((int) $lock->fetchColumn() !== 1) {
        return ['created' => false, 'reason' => 'lock_busy'] + backup_bookings_status();
    }

    try {
        if (!$force) {
            $status = backup_bookings_status();
            if ($status['seconds_until_next'] > 0) {
                return ['created' => false, 'reason' => 'interval_not_elapsed_after_lock'] + $status;
            }
        }
        return backup_bookings_create_snapshot($pdo);
    } finally {
        $release = $pdo->prepare('SELECT RELEASE_LOCK(?)');
        $release->execute([$lockName]);
    }
}

function backup_bookings_maybe_run_silent(): void
{
    try {
        $pdo = db();
        backup_bookings_run($pdo, false);
    } catch (Throwable $e) {
        // backup jest pomocniczy — nie może blokować API
    }
}
