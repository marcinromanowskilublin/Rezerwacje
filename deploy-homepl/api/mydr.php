<?php
declare(strict_types=1);

// Automatyczne przenoszenie rezerwacji ze strony do MyDr EDM (wizyty w kalendarzu lekarza).

function mydr_configured(): bool
{
    global $config;
    return !empty($config['mydr_enabled'])
        && trim((string) ($config['mydr_client_id'] ?? '')) !== ''
        && trim((string) ($config['mydr_client_secret'] ?? '')) !== ''
        && (int) ($config['mydr_doctor_id'] ?? 0) > 0
        && (int) ($config['mydr_office_id'] ?? 0) > 0;
}

function mydr_base_url(): string
{
    global $config;
    $base = trim((string) ($config['mydr_base_url'] ?? ''));
    return rtrim($base !== '' ? $base : 'https://edm.mydr.pl/secure/ext_api', '/');
}

function mydr_http(string $method, string $url, ?array $body, array $headers, bool $form = false): array
{
    if (!function_exists('curl_init')) {
        return ['status' => 0, 'data' => null, 'error' => 'Brak rozszerzenia cURL.'];
    }
    $curl = curl_init($url);
    $options = [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers),
    ];
    if ($body !== null) {
        if ($form) {
            $options[CURLOPT_POSTFIELDS] = http_build_query($body);
        } else {
            $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
            $options[CURLOPT_HTTPHEADER][] = 'Content-Type: application/json';
        }
    }
    curl_setopt_array($curl, $options);
    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = $raw === false ? curl_error($curl) : '';
    curl_close($curl);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    return ['status' => $status, 'data' => $data, 'error' => $error];
}

function mydr_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mydr_tokens (
            id tinyint unsigned NOT NULL,
            access_token varchar(255) NOT NULL,
            refresh_token varchar(255) NOT NULL,
            access_expires_at datetime NOT NULL,
            last_retry_at datetime DEFAULT NULL,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mydr_booking_links (
            booking_id varchar(36) NOT NULL,
            patient_id int unsigned DEFAULT NULL,
            visit_id int unsigned DEFAULT NULL,
            sync_status enum('pending','synced','skipped','needs_review','error') NOT NULL DEFAULT 'pending',
            sync_error varchar(255) DEFAULT NULL,
            attempts smallint unsigned NOT NULL DEFAULT 0,
            synced_at datetime DEFAULT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (booking_id),
            KEY idx_mydr_sync_status (sync_status),
            CONSTRAINT fk_mydr_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $ready = true;
}

function mydr_token_row(PDO $pdo): ?array
{
    mydr_ensure_tables($pdo);
    $row = $pdo->query('SELECT * FROM mydr_tokens WHERE id = 1')->fetch();
    return $row ?: null;
}

function mydr_store_tokens(PDO $pdo, string $access, string $refresh, int $expiresIn): void
{
    $expiresAt = date('Y-m-d H:i:s', time() + max(60, $expiresIn));
    $pdo->prepare(
        'INSERT INTO mydr_tokens (id, access_token, refresh_token, access_expires_at)
         VALUES (1, ?, ?, ?)
         ON DUPLICATE KEY UPDATE access_token = VALUES(access_token),
             refresh_token = VALUES(refresh_token),
             access_expires_at = VALUES(access_expires_at)'
    )->execute([$access, $refresh, $expiresAt]);
}

// MyDr unieważnia stary refresh token przy każdym odświeżeniu, więc odświeżanie
// musi iść pod blokadą, a nowa para tokenów trafia do bazy, nie do config.php.
function mydr_refresh_access_token(PDO $pdo, ?string $staleAccess = null): ?string
{
    global $config;
    $lock = $pdo->prepare('SELECT GET_LOCK(?, 10)');
    $lock->execute(['rez_mydr_token']);
    if ((int) $lock->fetchColumn() !== 1) {
        return null;
    }
    try {
        $row = mydr_token_row($pdo);
        if ($row && $staleAccess !== null && (string) $row['access_token'] !== $staleAccess
            && strtotime((string) $row['access_expires_at']) > time() + 60) {
            return (string) $row['access_token'];
        }
        $refresh = $row ? (string) $row['refresh_token'] : '';
        if ($refresh === '') {
            $refresh = trim((string) ($config['mydr_refresh_token'] ?? ''));
        }
        if ($refresh === '') {
            return null;
        }
        $response = mydr_http('POST', mydr_base_url() . '/o/token/', [
            'grant_type' => 'refresh_token',
            'refresh_token' => $refresh,
            'client_id' => (string) $config['mydr_client_id'],
            'client_secret' => (string) $config['mydr_client_secret'],
        ], [], true);
        $data = $response['data'];
        if ($response['status'] !== 200 || !is_array($data) || empty($data['access_token']) || empty($data['refresh_token'])) {
            error_log('MyDr token refresh failed: HTTP ' . $response['status']);
            return null;
        }
        mydr_store_tokens($pdo, (string) $data['access_token'], (string) $data['refresh_token'], (int) ($data['expires_in'] ?? 36000));
        return (string) $data['access_token'];
    } finally {
        $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute(['rez_mydr_token']);
    }
}

function mydr_access_token(PDO $pdo): ?string
{
    $row = mydr_token_row($pdo);
    if ($row && strtotime((string) $row['access_expires_at']) > time() + 60) {
        return (string) $row['access_token'];
    }
    return mydr_refresh_access_token($pdo);
}

function mydr_api(PDO $pdo, string $method, string $path, ?array $body = null): array
{
    $token = mydr_access_token($pdo);
    if ($token === null) {
        return ['status' => 0, 'data' => null, 'error' => 'Brak ważnego tokenu MyDr.'];
    }
    $url = mydr_base_url() . '/' . ltrim($path, '/');
    $response = mydr_http($method, $url, $body, ['Authorization: Bearer ' . $token]);
    if ($response['status'] === 401) {
        $token = mydr_refresh_access_token($pdo, $token);
        if ($token === null) {
            return ['status' => 401, 'data' => null, 'error' => 'MyDr odrzucił token.'];
        }
        $response = mydr_http($method, $url, $body, ['Authorization: Bearer ' . $token]);
    }
    return $response;
}

function mydr_api_error(array $response): string
{
    if ($response['error'] !== '') {
        return substr($response['error'], 0, 250);
    }
    $data = $response['data'];
    $detail = is_array($data) ? (string) ($data['detail'] ?? $data['code'] ?? '') : '';
    if (is_array($data) && $detail === '' && isset($data['errors']) && is_array($data['errors'])) {
        $detail = (string) json_encode($data['errors'], JSON_UNESCAPED_UNICODE);
    }
    return substr('HTTP ' . $response['status'] . ($detail !== '' ? ': ' . $detail : ''), 0, 250);
}

function mydr_split_name(string $full): array
{
    $full = trim((string) preg_replace('/\s+/u', ' ', $full));
    $pos = mb_strrpos($full, ' ');
    if ($pos === false) {
        return ['first' => $full, 'last' => ''];
    }
    return ['first' => trim(mb_substr($full, 0, $pos)), 'last' => trim(mb_substr($full, $pos + 1))];
}

function mydr_phone_variants(string $phone): array
{
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if ($digits === '') {
        return [];
    }
    $normalized = $digits;
    if (strpos($normalized, '00') === 0) {
        $normalized = substr($normalized, 2);
    }
    if (strlen($normalized) === 11 && strpos($normalized, '48') === 0) {
        $normalized = substr($normalized, 2);
    }
    if (strlen($normalized) === 10 && strpos($normalized, '0') === 0) {
        $normalized = substr($normalized, 1);
    }
    $variants = [];
    $add = static function (string $value) use (&$variants): void {
        if ($value !== '' && !in_array($value, $variants, true)) {
            $variants[] = $value;
        }
    };
    if (strlen($normalized) === 9) {
        foreach ([$normalized, '+48' . $normalized, '48' . $normalized, '0' . $normalized, '00' . $normalized, '0048' . $normalized] as $variant) {
            $add($variant);
        }
        $add($digits);
        return $variants;
    }
    $add($digits);
    $add('+' . $digits);
    if ($normalized !== $digits) {
        $add($normalized);
        $add('+' . $normalized);
    }
    return $variants;
}

function mydr_same_surname(string $a, string $b): bool
{
    $normalize = static fn(string $value): string => mb_strtolower(trim($value));
    return $normalize($a) !== '' && $normalize($a) === $normalize($b);
}

// Pacjenta wiążemy tylko przy zgodnym nazwisku i jednoznacznym wyniku. Pomyłka
// dopięłaby wizytę do cudzej karty, więc niejednoznaczność zostaje do ręcznej decyzji.
function mydr_pick_patient(array $candidates, string $surname): array
{
    $matches = [];
    foreach ($candidates as $patient) {
        if (is_array($patient) && mydr_same_surname((string) ($patient['surname'] ?? ''), $surname)) {
            $matches[(int) $patient['id']] = true;
        }
    }
    if (count($matches) === 1) {
        return ['result' => 'found', 'id' => (int) array_key_first($matches)];
    }
    return ['result' => $matches === [] ? 'none' : 'ambiguous', 'id' => null];
}

function mydr_find_or_create_patient(PDO $pdo, array $booking): array
{
    $name = mydr_split_name((string) ($booking['patient_name'] ?? ''));
    if ($name['first'] === '' || $name['last'] === '') {
        return ['ok' => false, 'status' => 'needs_review', 'error' => 'Brak imienia lub nazwiska do karty MyDr.'];
    }

    $queries = [];
    $email = trim((string) ($booking['patient_email'] ?? ''));
    if ($email !== '') {
        $queries[] = ['email' => $email];
    }
    foreach (mydr_phone_variants((string) ($booking['patient_phone'] ?? '')) as $variant) {
        $queries[] = ['telephone' => $variant];
    }

    foreach ($queries as $query) {
        $response = mydr_api($pdo, 'GET', 'patients/?' . http_build_query($query + ['page_size' => 50]));
        if ($response['status'] !== 200) {
            return ['ok' => false, 'status' => 'error', 'error' => mydr_api_error($response)];
        }
        $pick = mydr_pick_patient((array) ($response['data']['results'] ?? []), $name['last']);
        if ($pick['result'] === 'found') {
            return ['ok' => true, 'id' => $pick['id'], 'created' => false];
        }
        if ($pick['result'] === 'ambiguous') {
            return ['ok' => false, 'status' => 'needs_review', 'error' => 'Kilka kart MyDr pasuje do pacjenta — wybierz ręcznie.'];
        }
    }

    $phones = mydr_phone_variants((string) ($booking['patient_phone'] ?? ''));
    $payload = array_filter([
        'name' => $name['first'],
        'surname' => $name['last'],
        'email' => $email,
        'telephone' => $phones[0] ?? '',
    ], static fn($value): bool => $value !== '');
    $response = mydr_api($pdo, 'POST', 'patients/', $payload);
    if (!in_array($response['status'], [200, 201], true) || empty($response['data']['id'])) {
        return ['ok' => false, 'status' => 'error', 'error' => mydr_api_error($response)];
    }
    return ['ok' => true, 'id' => (int) $response['data']['id'], 'created' => true];
}

function mydr_visit_state(array $booking): ?string
{
    $status = (string) ($booking['status'] ?? '');
    if ($status === 'cancelled') {
        return 'Anulowana';
    }
    if ($status === 'confirmed') {
        return (string) ($booking['payment_status'] ?? '') === 'paid' ? 'Zaplanowana i opłacona' : 'Zaplanowana';
    }
    if ($status === 'pending' || $status === 'pending_payment') {
        return 'Rezerwacja';
    }
    return null;
}

function mydr_visit_update_payload(array $booking): array
{
    $payload = [
        'date' => (string) $booking['booking_date'],
        'timeFrom' => hm((string) $booking['start_time']) . ':00',
        'timeTo' => hm((string) $booking['end_time']) . ':00',
        'confirmed' => (string) ($booking['status'] ?? '') === 'confirmed',
    ];
    $state = mydr_visit_state($booking);
    if ($state !== null) {
        $payload['state'] = $state;
    }
    return $payload;
}

function mydr_visit_create_payload(array $booking, ?array $visitType): array
{
    global $config;
    $payload = mydr_visit_update_payload($booking);
    $label = trim((string) ($visitType['name'] ?? ''));
    $payload['note'] = 'Rezerwacja online marcin-romanowski.pl' . ($label !== '' ? ' — ' . $label : '');
    $payload['visit_kind'] = 'Prywatna';
    $payload['evisit'] = !empty($config['mydr_evisit']);
    return $payload;
}

// Ponowienie po timeoucie nie może założyć drugiej wizyty, jeśli MyDr przyjął pierwszą.
function mydr_find_existing_visit(PDO $pdo, int $patientId, array $booking): array
{
    global $config;
    $date = (string) $booking['booking_date'];
    $response = mydr_api($pdo, 'GET', 'patients/' . $patientId . '/visits/?' . http_build_query([
        'date_from' => $date,
        'date_to' => $date,
        'page_size' => 50,
    ]));
    if ($response['status'] !== 200) {
        return ['ok' => false, 'visit_id' => null, 'error' => mydr_api_error($response)];
    }
    foreach ((array) ($response['data']['results'] ?? []) as $visit) {
        if (is_array($visit)
            && (int) ($visit['doctor'] ?? 0) === (int) $config['mydr_doctor_id']
            && hm((string) ($visit['timeFrom'] ?? '')) === hm((string) $booking['start_time'])
            && (string) ($visit['state'] ?? '') !== 'Anulowana') {
            return ['ok' => true, 'visit_id' => (int) $visit['id']];
        }
    }
    return ['ok' => true, 'visit_id' => null];
}

function mydr_link(PDO $pdo, string $bookingId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM mydr_booking_links WHERE booking_id = ?');
    $stmt->execute([$bookingId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function mydr_save_link(PDO $pdo, string $bookingId, ?int $patientId, ?int $visitId, string $status, string $error = ''): void
{
    $pdo->prepare(
        'INSERT INTO mydr_booking_links (booking_id, patient_id, visit_id, sync_status, sync_error, attempts, synced_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE patient_id = VALUES(patient_id), visit_id = VALUES(visit_id),
             sync_status = VALUES(sync_status), sync_error = VALUES(sync_error),
             attempts = attempts + 1, synced_at = NOW()'
    )->execute([$bookingId, $patientId, $visitId, $status, $error !== '' ? $error : null]);
}

function mydr_sync_booking(PDO $pdo, string $bookingId): array
{
    global $config;
    if (!mydr_configured()) {
        return ['ok' => false, 'status' => 'disabled'];
    }

    $lockName = 'rez_mydr_b_' . substr(hash('sha256', $bookingId), 0, 32);
    $lock = $pdo->prepare('SELECT GET_LOCK(?, 15)');
    $lock->execute([$lockName]);
    if ((int) $lock->fetchColumn() !== 1) {
        return ['ok' => false, 'status' => 'busy'];
    }

    try {
        $stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = ?');
        $stmt->execute([$bookingId]);
        $booking = $stmt->fetch();
        if (!$booking) {
            return ['ok' => false, 'status' => 'missing'];
        }
        $booking = normalize_booking($booking);
        $link = mydr_link($pdo, $bookingId);
        $patientId = $link && $link['patient_id'] !== null ? (int) $link['patient_id'] : null;
        $visitId = $link && $link['visit_id'] !== null ? (int) $link['visit_id'] : null;
        $status = (string) $booking['status'];

        $notInCalendar = $visitId === null
            && !in_array($status, ['pending', 'pending_payment', 'confirmed'], true)
            && !($status === 'cancelled' && $patientId !== null);
        $closedLocally = $visitId !== null && in_array($status, ['completed', 'no_show'], true);
        if ($notInCalendar || $closedLocally) {
            if ($link) {
                mydr_save_link($pdo, $bookingId, $patientId, $visitId, $visitId !== null ? 'synced' : 'skipped');
            }
            return ['ok' => true, 'status' => 'skipped'];
        }

        if ($visitId !== null) {
            $response = mydr_api($pdo, 'PATCH', 'visits/' . $visitId . '/', mydr_visit_update_payload($booking));
            if ($response['status'] !== 200) {
                $error = mydr_api_error($response);
                mydr_save_link($pdo, $bookingId, $patientId, $visitId, 'error', $error);
                return ['ok' => false, 'status' => 'error', 'error' => $error];
            }
            mydr_save_link($pdo, $bookingId, $patientId, $visitId, 'synced');
            return ['ok' => true, 'status' => 'synced', 'visit_id' => $visitId];
        }

        if ($patientId === null) {
            $patient = mydr_find_or_create_patient($pdo, $booking);
            if (!$patient['ok']) {
                mydr_save_link($pdo, $bookingId, null, null, (string) $patient['status'], (string) $patient['error']);
                return $patient;
            }
            $patientId = (int) $patient['id'];
            mydr_save_link($pdo, $bookingId, $patientId, null, 'pending');
        }

        $existing = mydr_find_existing_visit($pdo, $patientId, $booking);
        if (empty($existing['ok'])) {
            $error = (string) ($existing['error'] ?? 'Nie udało się sprawdzić istniejących wizyt MyDr.');
            mydr_save_link($pdo, $bookingId, $patientId, null, 'error', $error);
            return ['ok' => false, 'status' => 'error', 'error' => $error];
        }
        $existingVisitId = $existing['visit_id'] !== null ? (int) $existing['visit_id'] : null;
        if ($existingVisitId !== null) {
            $response = mydr_api($pdo, 'PATCH', 'visits/' . $existingVisitId . '/', mydr_visit_update_payload($booking));
            if ($response['status'] !== 200) {
                $error = mydr_api_error($response);
                mydr_save_link($pdo, $bookingId, $patientId, $existingVisitId, 'error', $error);
                return ['ok' => false, 'status' => 'error', 'error' => $error];
            }
            mydr_save_link($pdo, $bookingId, $patientId, $existingVisitId, 'synced');
            return ['ok' => true, 'status' => 'synced', 'visit_id' => $existingVisitId];
        }

        if (!in_array($status, ['pending', 'pending_payment', 'confirmed'], true)) {
            mydr_save_link($pdo, $bookingId, $patientId, null, 'skipped');
            return ['ok' => true, 'status' => 'skipped'];
        }

        $visitType = visit_type($pdo, (string) $booking['visit_type_id'], false);
        $response = mydr_api($pdo, 'POST', 'visits/', mydr_visit_create_payload($booking, $visitType) + [
            'patient' => $patientId,
            'doctor' => (int) $config['mydr_doctor_id'],
            'office' => (int) $config['mydr_office_id'],
        ]);
        if (!in_array($response['status'], [200, 201], true) || empty($response['data']['id'])) {
            $error = mydr_api_error($response);
            mydr_save_link($pdo, $bookingId, $patientId, null, 'error', $error);
            return ['ok' => false, 'status' => 'error', 'error' => $error];
        }
        $visitId = (int) $response['data']['id'];
        mydr_save_link($pdo, $bookingId, $patientId, $visitId, 'synced');
        return ['ok' => true, 'status' => 'synced', 'visit_id' => $visitId, 'patient_id' => $patientId];
    } catch (Throwable $error) {
        error_log('MyDr sync failed: ' . $error->getMessage());
        return ['ok' => false, 'status' => 'error', 'error' => 'Wyjątek synchronizacji.'];
    } finally {
        $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
    }
}

// Synchronizacja po wysłaniu odpowiedzi, żeby pacjent nie czekał na MyDr.
function mydr_sync_after_response(string $bookingId): void
{
    static $queue = null;
    if (!mydr_configured() || $bookingId === '') {
        return;
    }
    if ($queue === null) {
        $queue = [];
        register_shutdown_function(static function () use (&$queue): void {
            if (function_exists('fastcgi_finish_request')) {
                @fastcgi_finish_request();
            }
            ignore_user_abort(true);
            try {
                $pdo = db();
                foreach (array_keys($queue) as $id) {
                    mydr_sync_booking($pdo, (string) $id);
                }
            } catch (Throwable $error) {
                error_log('MyDr deferred sync failed: ' . $error->getMessage());
            }
        });
    }
    $queue[$bookingId] = true;
}

function mydr_retry_candidates(PDO $pdo, int $limit): array
{
    $stmt = $pdo->prepare(
        "SELECT b.id
         FROM bookings b
         LEFT JOIN mydr_booking_links l ON l.booking_id = b.id
         WHERE b.booking_date >= CURDATE()
           AND b.created_at >= ?
           AND (
             (l.booking_id IS NULL AND b.status IN ('pending', 'pending_payment', 'confirmed'))
             OR (l.sync_status IN ('error', 'pending') AND l.attempts < 20)
           )
         ORDER BY b.booking_date ASC, b.start_time ASC
         LIMIT " . max(1, $limit)
    );
    global $config;
    $since = trim((string) ($config['mydr_sync_since'] ?? ''));
    $stmt->execute([preg_match('/^\d{4}-\d{2}-\d{2}/', $since) ? $since : date('Y-m-d 00:00:00')]);
    return array_map(static fn(array $row): string => (string) $row['id'], $stmt->fetchAll());
}

function mydr_retry_maybe_run_silent(): void
{
    if (!mydr_configured()) {
        return;
    }
    try {
        $pdo = db();
        $row = mydr_token_row($pdo);
        $last = $row && !empty($row['last_retry_at']) ? strtotime((string) $row['last_retry_at']) : 0;
        if ($last > time() - 900) {
            return;
        }
        $pdo->prepare(
            'INSERT INTO mydr_tokens (id, access_token, refresh_token, access_expires_at, last_retry_at)
             VALUES (1, \'\', \'\', NOW(), NOW())
             ON DUPLICATE KEY UPDATE last_retry_at = NOW()'
        )->execute();
        foreach (mydr_retry_candidates($pdo, 10) as $id) {
            mydr_sync_after_response($id);
        }
    } catch (Throwable $error) {
        error_log('MyDr retry scheduling failed: ' . $error->getMessage());
    }
}

function mydr_handle_admin_route(string $route, string $method): bool
{
    if ($route === '/admin/mydr/status' && $method === 'GET') {
        require_admin();
        $result = ['configured' => mydr_configured(), 'connected' => false, 'links' => []];
        if ($result['configured']) {
            $pdo = db();
            $self = mydr_api($pdo, 'GET', 'self/');
            $result['connected'] = $self['status'] === 200;
            if (!$result['connected']) {
                $result['error'] = mydr_api_error($self);
            }
            $result['links'] = $pdo->query(
                'SELECT sync_status, COUNT(*) AS cnt FROM mydr_booking_links GROUP BY sync_status'
            )->fetchAll();
            $result['problems'] = $pdo->query(
                "SELECT l.booking_id, b.booking_date, b.start_time, l.sync_status, l.sync_error
                 FROM mydr_booking_links l JOIN bookings b ON b.id = l.booking_id
                 WHERE l.sync_status IN ('error', 'needs_review', 'pending')
                 ORDER BY b.booking_date DESC LIMIT 20"
            )->fetchAll();
        }
        json_response($result);
    }

    if ($route === '/admin/mydr/sync' && $method === 'POST') {
        require_admin();
        if (!mydr_configured()) {
            json_response(['ok' => false, 'error' => 'MyDr nie jest skonfigurowany w config.php.'], 400);
        }
        $pdo = db();
        $data = json_input();
        $bookingId = trim((string) ($data['booking_id'] ?? ''));
        $patientId = (int) ($data['patient_id'] ?? 0);
        if ($bookingId !== '' && $patientId > 0) {
            $link = mydr_link($pdo, $bookingId);
            if ($link && $link['visit_id'] !== null) {
                json_response(['ok' => false, 'error' => 'Wizyta jest już w MyDr.'], 409);
            }
            mydr_save_link($pdo, $bookingId, $patientId, null, 'pending');
        }
        $ids = $bookingId !== '' ? [$bookingId] : mydr_retry_candidates($pdo, 50);
        $results = [];
        foreach ($ids as $id) {
            $results[$id] = mydr_sync_booking($pdo, $id);
        }
        json_response(['ok' => true, 'results' => $results]);
    }

    return false;
}
