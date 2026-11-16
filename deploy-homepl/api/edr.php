<?php
declare(strict_types=1);

const EDR_MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const EDR_ALLOWED_AUDIO_TYPES = [
    'audio/webm',
    'audio/ogg',
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp4',
    'video/webm',
];

function edr_config_value(string $key, $default = '')
{
    global $config;
    if (is_array($config) && array_key_exists($key, $config)) {
        return $config[$key];
    }
    if (is_array($config['edr'] ?? null) && array_key_exists($key, $config['edr'])) {
        return $config['edr'][$key];
    }
    return $default;
}

function edr_bool(string $key, bool $default = false): bool
{
    $val = edr_config_value($key, null);
    if ($val === null) {
        return $default;
    }
    if (is_bool($val)) {
        return $val;
    }
    return filter_var($val, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? $default;
}

function edr_str(string $key, string $default = ''): string
{
    return trim((string) edr_config_value($key, $default));
}

function edr_int(string $key, int $default = 0): int
{
    return (int) edr_config_value($key, $default);
}

function edr_base_url(): string
{
    $url = edr_str('edr_base_url', edr_str('base_url', 'https://edm.mydr.pl/secure/ext_api'));
    $url = rtrim($url, '/');
    if (!str_ends_with($url, '/secure/ext_api')) {
        $url .= '/secure/ext_api';
    }
    return $url;
}

function edr_doctor_id(): int
{
    return edr_int('edr_doctor_id', edr_int('doctor_id', 21239));
}

function edr_office_id(): int
{
    return edr_int('edr_office_id', edr_int('office_id', 76376));
}

function edr_deepgram_key(): string
{
    global $config;
    $direct = edr_str('deepgram_api_key', '');
    if ($direct !== '') {
        return $direct;
    }
    if (is_array($config['deepgram'] ?? null) && !empty($config['deepgram']['api_key'])) {
        return trim((string) $config['deepgram']['api_key']);
    }
    return trim((string) (getenv('DEEPGRAM_API_KEY') ?: ''));
}

function edr_deepgram_url(): string
{
    global $config;
    $direct = edr_str('deepgram_base_url', '');
    if ($direct !== '') {
        return rtrim($direct, '/');
    }
    if (is_array($config['deepgram'] ?? null) && !empty($config['deepgram']['base_url'])) {
        return rtrim(trim((string) $config['deepgram']['base_url']), '/');
    }
    return 'https://api.eu.deepgram.com';
}

function edr_configured(): bool
{
    $access = edr_str('edr_access_token', edr_str('access_token', ''));
    $refresh = edr_str('edr_refresh_token', edr_str('refresh_token', ''));
    $clientId = edr_str('edr_client_id', edr_str('client_id', ''));
    $clientSecret = edr_str('edr_client_secret', edr_str('client_secret', ''));

    return $access !== '' || ($refresh !== '' && $clientId !== '' && $clientSecret !== '');
}

function edr_enabled(): bool
{
    return edr_bool('edr_enabled', edr_bool('enabled', false)) && edr_configured();
}

function edr_auto_sync_bookings(): bool
{
    return edr_enabled() && edr_bool('edr_auto_sync_bookings', true);
}

function edr_spoken_note_sync_enabled(): bool
{
    return edr_enabled() && edr_bool('edr_spoken_note_sync_enabled', true);
}

function edr_iso(?string $value): ?string
{
    if ($value === null || trim($value) === '') {
        return null;
    }
    return str_replace(' ', 'T', trim($value)) . 'Z';
}

function edr_status(): array
{
    return [
        'enabled' => edr_enabled(),
        'configured' => edr_configured(),
        'booking_sync_ready' => edr_configured() && edr_doctor_id() > 0 && edr_office_id() > 0,
        'base_url' => edr_base_url(),
        'access_token_configured' => edr_str('edr_access_token', edr_str('access_token', '')) !== '',
        'refresh_token_configured' => edr_str('edr_refresh_token', edr_str('refresh_token', '')) !== '',
        'doctor_id_set' => edr_doctor_id() > 0,
        'office_id_set' => edr_office_id() > 0,
        'doctor_id' => edr_doctor_id(),
        'office_id' => edr_office_id(),
        'auto_sync_bookings' => edr_auto_sync_bookings(),
        'spoken_note_sync_enabled' => edr_spoken_note_sync_enabled(),
        'deepgram_configured' => edr_deepgram_key() !== '',
        'plan' => [
            'visit_endpoint' => '/secure/ext_api/visits/',
            'patients_endpoint' => '/secure/ext_api/patients/',
            'token_endpoint' => '/secure/ext_api/o/token/',
            'spoken_note_strategy' => 'Umówiona wizyta tworzy/aktualizuje wpis w MyDr EDM, a podyktowana wizyta mówiona dopisuje wywiad, badanie i zalecenia bezpośrednio do wizyty w MyDr (PATCH /secure/ext_api/visits/{id}/).',
        ],
    ];
}

function edr_ensure_tables(PDO $pdo): void
{
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS edr_visit_links (
            booking_id varchar(36) NOT NULL,
            edr_visit_id varchar(80) DEFAULT NULL,
            edr_patient_id varchar(80) DEFAULT NULL,
            status varchar(20) NOT NULL DEFAULT 'pending',
            last_error text DEFAULT NULL,
            request_payload longtext DEFAULT NULL,
            response_payload longtext DEFAULT NULL,
            synced_at datetime DEFAULT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (booking_id),
            KEY idx_edr_visit_links_visit (edr_visit_id),
            CONSTRAINT fk_edr_visit_links_booking
                FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS edr_spoken_notes (
            id char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            booking_id varchar(36) NOT NULL,
            edr_visit_id varchar(80) DEFAULT NULL,
            source varchar(40) NOT NULL DEFAULT 'voice',
            target_field varchar(32) NOT NULL DEFAULT 'interview',
            transcript_text longtext DEFAULT NULL,
            examination_text longtext DEFAULT NULL,
            recommendation_text longtext DEFAULT NULL,
            summary_text text DEFAULT NULL,
            status varchar(20) NOT NULL DEFAULT 'pending',
            last_error text DEFAULT NULL,
            edr_response_payload longtext DEFAULT NULL,
            synced_at datetime DEFAULT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_edr_spoken_notes_booking (booking_id, created_at),
            KEY idx_edr_spoken_notes_status (status, created_at),
            CONSTRAINT fk_edr_spoken_notes_booking
                FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $ensured = true;
}

function edr_state_path(): string
{
    $custom = edr_str('edr_token_file', edr_str('token_file', ''));
    if ($custom !== '') {
        return $custom;
    }
    return dirname(__DIR__) . '/storage/edr/tokens.json';
}

function edr_read_tokens(): array
{
    $tokens = [
        'access_token' => edr_str('edr_access_token', edr_str('access_token', '')),
        'refresh_token' => edr_str('edr_refresh_token', edr_str('refresh_token', '')),
    ];
    $path = edr_state_path();
    if (!is_file($path)) {
        return $tokens;
    }
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) {
        return $tokens;
    }
    if (!empty($decoded['access_token']) && is_string($decoded['access_token'])) {
        $tokens['access_token'] = trim($decoded['access_token']);
    }
    if (!empty($decoded['refresh_token']) && is_string($decoded['refresh_token'])) {
        $tokens['refresh_token'] = trim($decoded['refresh_token']);
    }
    return $tokens;
}

function edr_write_tokens(array $tokens): void
{
    $path = edr_state_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
        return;
    }
    $payload = json_encode([
        'access_token' => (string) ($tokens['access_token'] ?? ''),
        'refresh_token' => (string) ($tokens['refresh_token'] ?? ''),
        'updated_at' => gmdate('c'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (is_string($payload)) {
        @file_put_contents($path, $payload, LOCK_EX);
        @chmod($path, 0600);
    }
}

function edr_http(string $method, string $url, array $headers = [], ?string $body = null): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('Serwer nie obsługuje rozszerzenia cURL.');
    }
    $ch = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => $headers,
    ];
    if ($body !== null) {
        $options[CURLOPT_POSTFIELDS] = $body;
    }
    curl_setopt_array($ch, $options);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if (!is_string($raw)) {
        throw new RuntimeException($error !== '' ? $error : 'Błąd połączenia z MyDr EDR.');
    }
    return [
        'status' => $status,
        'raw' => $raw,
        'data' => $raw !== '' ? json_decode($raw, true) : null,
    ];
}

function edr_refresh_access_token(?string $refreshToken = null): string
{
    $tokens = edr_read_tokens();
    $refresh = $refreshToken !== null && $refreshToken !== '' ? $refreshToken : $tokens['refresh_token'];
    $clientId = edr_str('edr_client_id', edr_str('client_id', ''));
    $clientSecret = edr_str('edr_client_secret', edr_str('client_secret', ''));

    if ($refresh === '' || $clientId === '' || $clientSecret === '') {
        throw new RuntimeException('Brak danych OAuth2 (client_id / client_secret / refresh_token) do odświeżenia tokenu EDR.');
    }

    $resp = edr_http(
        'POST',
        edr_base_url() . '/o/token/',
        [
            'Accept: application/json',
            'Content-Type: application/x-www-form-urlencoded',
        ],
        http_build_query([
            'grant_type' => 'refresh_token',
            'refresh_token' => $refresh,
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
        ])
    );

    $data = $resp['data'];
    if ($resp['status'] < 200 || $resp['status'] >= 300 || !is_array($data) || empty($data['access_token'])) {
        throw new RuntimeException('Nie udało się odświeżyć tokenu OAuth2 w MyDr EDR (HTTP ' . $resp['status'] . ').');
    }

    $newTokens = [
        'access_token' => trim((string) $data['access_token']),
        'refresh_token' => trim((string) ($data['refresh_token'] ?? $refresh)),
    ];
    edr_write_tokens($newTokens);
    return $newTokens['access_token'];
}

function edr_request(string $method, string $path, ?array $payload = null): array
{
    $tokens = edr_read_tokens();
    $accessToken = $tokens['access_token'];
    if ($accessToken === '' && $tokens['refresh_token'] !== '') {
        $accessToken = edr_refresh_access_token($tokens['refresh_token']);
    }
    if ($accessToken === '') {
        throw new RuntimeException('Brak tokenu dostępowego MyDr EDR.');
    }

    $url = edr_base_url() . '/' . ltrim($path, '/');
    $headers = [
        'Accept: application/json',
        'Authorization: Bearer ' . $accessToken,
    ];
    $body = null;
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    $resp = edr_http($method, $url, $headers, $body);
    if ($resp['status'] === 401 && $tokens['refresh_token'] !== '') {
        $accessToken = edr_refresh_access_token($tokens['refresh_token']);
        $headers[1] = 'Authorization: Bearer ' . $accessToken;
        $resp = edr_http($method, $url, $headers, $body);
    }

    if ($resp['status'] < 200 || $resp['status'] >= 300) {
        $detail = '';
        if (is_array($resp['data'])) {
            $detail = (string) ($resp['data']['detail'] ?? $resp['data']['error'] ?? $resp['data']['message'] ?? '');
            if ($detail === '') {
                $detail = json_encode($resp['data'], JSON_UNESCAPED_UNICODE);
            }
        }
        throw new RuntimeException('MyDr EDR zwrócił HTTP ' . $resp['status'] . ($detail !== '' ? ': ' . $detail : ''));
    }

    return is_array($resp['data']) ? $resp['data'] : [];
}

function edr_split_patient_name(string $fullName): array
{
    $clean = trim((string) preg_replace('/\s+/u', ' ', $fullName));
    if ($clean === '') {
        return ['first' => '', 'last' => ''];
    }
    $pos = function_exists('mb_strrpos') ? mb_strrpos($clean, ' ') : strrpos($clean, ' ');
    if ($pos === false) {
        return ['first' => $clean, 'last' => ''];
    }
    if (function_exists('mb_substr')) {
        return [
            'first' => trim(mb_substr($clean, 0, $pos)),
            'last' => trim(mb_substr($clean, $pos + 1)),
        ];
    }
    return [
        'first' => trim(substr($clean, 0, $pos)),
        'last' => trim(substr($clean, $pos + 1)),
    ];
}

function edr_phone_variants(string $phone): array
{
    $digits = preg_replace('/\D+/', '', $phone) ?: '';
    if (strlen($digits) === 11 && str_starts_with($digits, '48')) {
        $digits = substr($digits, 2);
    }
    if ($digits === '') {
        return [];
    }
    if (strlen($digits) === 9) {
        return [$digits, '+48' . $digits, '48' . $digits];
    }
    return [$digits, '+' . $digits];
}

function edr_normalize_text(string $value): string
{
    $lower = function_exists('mb_strtolower') ? mb_strtolower(trim($value), 'UTF-8') : strtolower(trim($value));
    return trim((string) preg_replace('/\s+/u', ' ', $lower));
}

function edr_find_or_create_patient(array $booking): string
{
    $configuredDefault = edr_str('edr_default_patient_id', '');
    $name = edr_split_patient_name((string) ($booking['patient_name'] ?? ''));
    $email = trim((string) ($booking['patient_email'] ?? ''));
    $phones = edr_phone_variants((string) ($booking['patient_phone'] ?? ''));

    $queries = [];
    if ($email !== '') {
        $queries[] = ['email' => $email];
    }
    foreach ($phones as $variant) {
        $queries[] = ['telephone' => $variant];
    }

    foreach ($queries as $q) {
        $data = edr_request('GET', 'patients/?' . http_build_query($q + ['page_size' => 50]));
        $results = (array) ($data['results'] ?? []);
        $matchedIds = [];
        foreach ($results as $patient) {
            if (!is_array($patient) || empty($patient['id'])) {
                continue;
            }
            $surname = edr_normalize_text((string) ($patient['surname'] ?? ''));
            if ($name['last'] === '' || ($surname !== '' && $surname === edr_normalize_text($name['last']))) {
                $matchedIds[(string) $patient['id']] = true;
            }
        }
        if (count($matchedIds) === 1) {
            return (string) array_key_first($matchedIds);
        }
        if (count($matchedIds) > 1) {
            throw new RuntimeException('W MyDr znaleziono kilka kart pacjentów o tym samym nazwisku i kontakcie — wskaż ID pacjenta ręcznie.');
        }
    }

    if ($configuredDefault !== '') {
        return $configuredDefault;
    }

    if (!edr_bool('edr_auto_create_patient', true)) {
        throw new RuntimeException('Nie znaleziono pacjenta w MyDr (automatyczne zakładanie kartoteki jest wyłączone).');
    }

    if ($name['first'] === '' || $name['last'] === '') {
        throw new RuntimeException('Brak pełnego imienia i nazwiska pacjenta do założenia kartoteki w MyDr.');
    }

    $createPayload = [
        'name' => $name['first'],
        'surname' => $name['last'],
        'country' => 'PL',
    ];
    if ($email !== '') {
        $createPayload['email'] = $email;
    }
    if ($phones !== []) {
        $createPayload['telephone'] = $phones[0];
    }

    $created = edr_request('POST', 'patients/', $createPayload);
    $newId = trim((string) ($created['id'] ?? ''));
    if ($newId === '') {
        throw new RuntimeException('MyDr nie zwrócił ID nowo utworzonego pacjenta.');
    }
    return $newId;
}

function edr_visit_state_for_booking(array $booking): string
{
    $status = (string) ($booking['status'] ?? 'pending');
    $payment = (string) ($booking['payment_status'] ?? 'unpaid');
    if ($status === 'cancelled') {
        return 'Anulowana';
    }
    if ($status === 'completed') {
        return 'Zakończona';
    }
    if ($status === 'confirmed') {
        return $payment === 'paid' ? 'Zaplanowana i opłacona' : 'Zaplanowana';
    }
    if ($status === 'pending_payment') {
        return 'Oczekuje na płatność';
    }
    return edr_str('edr_default_visit_state', 'Zaplanowana');
}

function edr_booking_payload(PDO $pdo, array $booking, string $patientId): array
{
    $visitType = visit_type($pdo, (string) ($booking['visit_type_id'] ?? ''), false);
    $visitLabel = trim((string) ($visitType['name'] ?? 'Konsultacja online'));
    $notePrefix = edr_str('edr_booking_note_prefix', 'Rezerwacja online marcin-romanowski.pl');
    $patientName = trim((string) ($booking['patient_name'] ?? ''));
    $patientPhone = trim((string) ($booking['patient_phone'] ?? ''));
    $start = hm((string) ($booking['start_time'] ?? ''));
    $end = hm((string) ($booking['end_time'] ?? ''));

    return [
        'patient' => ctype_digit($patientId) ? (int) $patientId : $patientId,
        'doctor' => edr_doctor_id(),
        'office' => edr_office_id(),
        'date' => (string) ($booking['booking_date'] ?? ''),
        'timeFrom' => $start !== '' ? $start . ':00' : '',
        'timeTo' => $end !== '' ? $end . ':00' : '',
        'state' => edr_visit_state_for_booking($booking),
        'visit_kind' => edr_str('edr_default_visit_kind', 'Prywatna'),
        'confirmed' => (string) ($booking['status'] ?? '') === 'confirmed',
        'evisit' => edr_bool('edr_default_evisit', true),
        'note' => mb_substr(trim($notePrefix . ' — ' . $visitLabel . "\n" . $patientName . ($patientPhone !== '' ? ' · ' . $patientPhone : '')), 0, 600),
    ];
}

function edr_find_existing_visit_for_patient(string $patientId, array $booking): ?string
{
    if (!ctype_digit($patientId)) {
        return null;
    }
    $date = (string) ($booking['booking_date'] ?? '');
    $start = hm((string) ($booking['start_time'] ?? ''));
    if ($date === '' || $start === '') {
        return null;
    }
    try {
        $data = edr_request('GET', 'patients/' . (int) $patientId . '/visits/?' . http_build_query([
            'date_from' => $date,
            'date_to' => $date,
            'page_size' => 50,
        ]));
        foreach ((array) ($data['results'] ?? []) as $visit) {
            if (!is_array($visit) || empty($visit['id'])) {
                continue;
            }
            if (
                (int) ($visit['doctor'] ?? 0) === edr_doctor_id()
                && hm((string) ($visit['timeFrom'] ?? '')) === $start
                && (string) ($visit['state'] ?? '') !== 'Anulowana'
            ) {
                return (string) $visit['id'];
            }
        }
    } catch (Throwable $e) {
        return null;
    }
    return null;
}

function edr_booking_link(PDO $pdo, string $bookingId): ?array
{
    edr_ensure_tables($pdo);
    $stmt = $pdo->prepare('SELECT * FROM edr_visit_links WHERE booking_id = ?');
    $stmt->execute([$bookingId]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    return [
        'booking_id' => (string) $row['booking_id'],
        'edr_visit_id' => $row['edr_visit_id'] !== null ? (string) $row['edr_visit_id'] : null,
        'edr_patient_id' => $row['edr_patient_id'] !== null ? (string) $row['edr_patient_id'] : null,
        'status' => (string) $row['status'],
        'last_error' => $row['last_error'] !== null ? (string) $row['last_error'] : null,
        'synced_at' => edr_iso($row['synced_at'] ?? null),
        'updated_at' => edr_iso((string) $row['updated_at']),
    ];
}

function edr_upsert_visit_link(PDO $pdo, string $bookingId, array $values): array
{
    edr_ensure_tables($pdo);
    $stmt = $pdo->prepare(
        'INSERT INTO edr_visit_links
            (booking_id, edr_visit_id, edr_patient_id, status, last_error, request_payload, response_payload, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            edr_visit_id = COALESCE(VALUES(edr_visit_id), edr_visit_id),
            edr_patient_id = COALESCE(VALUES(edr_patient_id), edr_patient_id),
            status = VALUES(status),
            last_error = VALUES(last_error),
            request_payload = COALESCE(VALUES(request_payload), request_payload),
            response_payload = COALESCE(VALUES(response_payload), response_payload),
            synced_at = COALESCE(VALUES(synced_at), synced_at)'
    );
    $visitId = $values['edr_visit_id'] ?? null;
    $stmt->execute([
        $bookingId,
        $visitId,
        $values['edr_patient_id'] ?? null,
        $values['status'] ?? 'pending',
        $values['last_error'] ?? null,
        isset($values['request_payload']) ? json_encode($values['request_payload'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        isset($values['response_payload']) ? json_encode($values['response_payload'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        $values['synced_at'] ?? null,
    ]);

    if ($visitId !== null && $visitId !== '') {
        $upd = $pdo->prepare('UPDATE bookings SET external_event_id = ? WHERE id = ?');
        $upd->execute(['mydr:' . $visitId, $bookingId]);
    }

    return edr_booking_link($pdo, $bookingId) ?? [];
}

function edr_sync_booking(PDO $pdo, array $booking, string $manualPatientId = ''): array
{
    edr_ensure_tables($pdo);
    $bookingId = (string) ($booking['id'] ?? '');
    if ($bookingId === '') {
        throw new RuntimeException('Brak identyfikatora rezerwacji.');
    }

    $existing = edr_booking_link($pdo, $bookingId);
    $patientId = $manualPatientId !== ''
        ? $manualPatientId
        : (string) ($existing['edr_patient_id'] ?? '');

    if (!edr_enabled()) {
        return edr_upsert_visit_link($pdo, $bookingId, [
            'edr_patient_id' => $patientId !== '' ? $patientId : null,
            'status' => 'pending',
            'last_error' => 'Integracja EDR (MyDr) jest wyłączona lub nieskonfigurowana w config.php.',
        ]);
    }

    try {
        if (!empty($existing['edr_visit_id'])) {
            $visitId = (string) $existing['edr_visit_id'];
            $patchPayload = [
                'date' => (string) $booking['booking_date'],
                'timeFrom' => hm((string) $booking['start_time']) . ':00',
                'timeTo' => hm((string) $booking['end_time']) . ':00',
                'state' => edr_visit_state_for_booking($booking),
                'confirmed' => (string) ($booking['status'] ?? '') === 'confirmed',
            ];
            $response = edr_request('PATCH', 'visits/' . rawurlencode($visitId) . '/', $patchPayload);
            return edr_upsert_visit_link($pdo, $bookingId, [
                'edr_visit_id' => $visitId,
                'edr_patient_id' => $patientId !== '' ? $patientId : null,
                'status' => 'synced',
                'last_error' => null,
                'request_payload' => $patchPayload,
                'response_payload' => $response,
                'synced_at' => gmdate('Y-m-d H:i:s'),
            ]);
        }

        if ($patientId === '') {
            $patientId = edr_find_or_create_patient($booking);
        }

        $alreadyInMydr = edr_find_existing_visit_for_patient($patientId, $booking);
        if ($alreadyInMydr !== null) {
            return edr_upsert_visit_link($pdo, $bookingId, [
                'edr_visit_id' => $alreadyInMydr,
                'edr_patient_id' => $patientId,
                'status' => 'synced',
                'last_error' => null,
                'synced_at' => gmdate('Y-m-d H:i:s'),
            ]);
        }

        $payload = edr_booking_payload($pdo, $booking, $patientId);
        $response = edr_request('POST', 'visits/', $payload);
        $visitId = trim((string) ($response['id'] ?? $response['pk'] ?? ''));
        if ($visitId === '') {
            throw new RuntimeException('MyDr utworzył wizytę, ale nie zwrócił jej ID.');
        }

        return edr_upsert_visit_link($pdo, $bookingId, [
            'edr_visit_id' => $visitId,
            'edr_patient_id' => $patientId,
            'status' => 'synced',
            'last_error' => null,
            'request_payload' => $payload,
            'response_payload' => $response,
            'synced_at' => gmdate('Y-m-d H:i:s'),
        ]);
    } catch (Throwable $error) {
        return edr_upsert_visit_link($pdo, $bookingId, [
            'edr_patient_id' => $patientId !== '' ? $patientId : null,
            'status' => 'failed',
            'last_error' => $error->getMessage(),
        ]);
    }
}

function edr_after_booking_changed(PDO $pdo, ?array $booking): void
{
    if (!$booking || !edr_auto_sync_bookings()) {
        return;
    }
    try {
        edr_sync_booking($pdo, $booking);
    } catch (Throwable $error) {
        error_log('EDR booking sync error: ' . $error->getMessage());
    }
}

function edr_transcribe_uploaded_audio(): array
{
    $key = edr_deepgram_key();
    if ($key === '') {
        throw new RuntimeException('Brak klucza Deepgram API (deepgram_api_key w config.php).');
    }
    $upload = $_FILES['audio'] ?? null;
    if (!is_array($upload) || (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Nie przesłano pliku audio z nagraniem.');
    }
    $size = (int) ($upload['size'] ?? 0);
    $tmp = (string) ($upload['tmp_name'] ?? '');
    if ($size < 1 || $size > EDR_MAX_AUDIO_BYTES || !is_uploaded_file($tmp)) {
        throw new RuntimeException('Nagranie jest puste albo przekracza limit 25 MB.');
    }
    $rawMime = strtolower(trim((string) ($upload['type'] ?? 'audio/webm')));
    $baseMime = trim(explode(';', $rawMime)[0]);
    if (!in_array($baseMime, EDR_ALLOWED_AUDIO_TYPES, true)) {
        throw new RuntimeException('Nieobsługiwany format audio: ' . $baseMime);
    }
    $audioBytes = file_get_contents($tmp);
    @unlink($tmp);
    if (!is_string($audioBytes) || $audioBytes === '') {
        throw new RuntimeException('Nie udało się odczytać przesłanego nagrania.');
    }

    $query = http_build_query([
        'model' => 'nova-3',
        'language' => 'pl',
        'smart_format' => 'true',
        'punctuate' => 'true',
        'paragraphs' => 'true',
        'diarize' => 'true',
        'mip_opt_out' => 'true',
    ]);
    $resp = edr_http(
        'POST',
        edr_deepgram_url() . '/v1/listen?' . $query,
        [
            'Authorization: Token ' . $key,
            'Content-Type: ' . $baseMime,
            'Accept: application/json',
        ],
        $audioBytes
    );
    $decoded = $resp['data'];
    $transcript = trim((string) (
        $decoded['results']['channels'][0]['alternatives'][0]['paragraphs']['transcript']
        ?? $decoded['results']['channels'][0]['alternatives'][0]['transcript']
        ?? ''
    ));
    if ($resp['status'] < 200 || $resp['status'] >= 300 || $transcript === '') {
        throw new RuntimeException('Deepgram nie zwrócił transkrypcji nagrania.');
    }
    return ['transcript' => $transcript];
}

function edr_append_field(string $existing, string $addition, int $maxLength = 32768): string
{
    $existing = trim($existing);
    $addition = trim($addition);
    if ($addition === '') {
        return $existing;
    }
    $stamp = '[Wizyta mówiona ' . date('Y-m-d H:i') . ']';
    $combined = $existing === ''
        ? $stamp . "\n" . $addition
        : $existing . "\n\n" . $stamp . "\n" . $addition;
    return mb_substr($combined, 0, $maxLength);
}

function edr_create_spoken_note(PDO $pdo, array $booking, array $data): array
{
    edr_ensure_tables($pdo);
    $bookingId = (string) ($booking['id'] ?? '');
    $transcript = trim((string) ($data['transcript'] ?? ''));
    $examination = trim((string) ($data['examination'] ?? ''));
    $recommendation = trim((string) ($data['recommendation'] ?? ''));
    $summary = trim((string) ($data['summary'] ?? ''));
    $patientId = trim((string) ($data['patient_id'] ?? ''));
    $source = preg_replace('/[^a-z0-9_-]/i', '', (string) ($data['source'] ?? 'voice')) ?: 'voice';
    $targetField = (string) ($data['target_field'] ?? 'interview');
    if (!in_array($targetField, ['interview', 'examination', 'recommendation', 'note'], true)) {
        $targetField = 'interview';
    }

    if ($bookingId === '' || ($transcript === '' && $examination === '' && $recommendation === '' && $summary === '')) {
        throw new RuntimeException('Wpisz lub podyktuj treść notatki z wizyty.');
    }

    $link = edr_booking_link($pdo, $bookingId);
    if ((empty($link['edr_visit_id'])) && edr_enabled()) {
        $link = edr_sync_booking($pdo, $booking, $patientId);
    }

    $edrVisitId = (string) ($link['edr_visit_id'] ?? '');
    $status = 'local';
    $lastError = null;
    $responsePayload = null;
    $syncedAt = null;

    if ($edrVisitId !== '' && edr_spoken_note_sync_enabled()) {
        try {
            $currentVisit = edr_request('GET', 'visits/' . rawurlencode($edrVisitId) . '/');
            $patch = [];

            if ($transcript !== '') {
                $maxLen = $targetField === 'note' ? 600 : 32768;
                $patch[$targetField] = edr_append_field(
                    (string) ($currentVisit[$targetField] ?? ''),
                    $transcript,
                    $maxLen
                );
            }
            if ($examination !== '') {
                $patch['examination'] = edr_append_field(
                    (string) ($currentVisit['examination'] ?? ''),
                    $examination,
                    32768
                );
            }
            if ($recommendation !== '') {
                $patch['recommendation'] = edr_append_field(
                    (string) ($currentVisit['recommendation'] ?? ''),
                    $recommendation,
                    32768
                );
            }
            if ($summary !== '' && !isset($patch['note'])) {
                $patch['note'] = edr_append_field(
                    (string) ($currentVisit['note'] ?? ''),
                    $summary,
                    600
                );
            }

            if ($patch !== []) {
                $responsePayload = edr_request('PATCH', 'visits/' . rawurlencode($edrVisitId) . '/', $patch);
            }
            $status = 'synced';
            $syncedAt = gmdate('Y-m-d H:i:s');
        } catch (Throwable $error) {
            $status = 'failed';
            $lastError = $error->getMessage();
        }
    } elseif (!edr_enabled()) {
        $lastError = 'Zapisano lokalnie — integracja EDR (MyDr) nie jest jeszcze włączona w config.php.';
    } elseif ($edrVisitId === '') {
        $status = 'pending';
        $lastError = $link['last_error'] ?? 'Wizyta nie ma jeszcze przypisanego ID w MyDr EDR.';
    }

    $id = bin2hex(random_bytes(16));
    $stmt = $pdo->prepare(
        'INSERT INTO edr_spoken_notes
            (id, booking_id, edr_visit_id, source, target_field, transcript_text, examination_text, recommendation_text, summary_text, status, last_error, edr_response_payload, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $id,
        $bookingId,
        $edrVisitId !== '' ? $edrVisitId : null,
        substr($source, 0, 40),
        $targetField,
        $transcript,
        $examination !== '' ? $examination : null,
        $recommendation !== '' ? $recommendation : null,
        $summary !== '' ? $summary : null,
        $status,
        $lastError,
        $responsePayload !== null ? json_encode($responsePayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        $syncedAt,
    ]);

    return edr_spoken_note($pdo, $id) ?? [];
}

function edr_spoken_note_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'booking_id' => (string) $row['booking_id'],
        'edr_visit_id' => $row['edr_visit_id'] !== null ? (string) $row['edr_visit_id'] : null,
        'source' => (string) $row['source'],
        'target_field' => (string) ($row['target_field'] ?? 'interview'),
        'transcript' => (string) ($row['transcript_text'] ?? ''),
        'examination' => (string) ($row['examination_text'] ?? ''),
        'recommendation' => (string) ($row['recommendation_text'] ?? ''),
        'summary' => (string) ($row['summary_text'] ?? ''),
        'status' => (string) $row['status'],
        'last_error' => $row['last_error'] !== null ? (string) $row['last_error'] : null,
        'created_at' => edr_iso((string) $row['created_at']),
        'synced_at' => edr_iso($row['synced_at'] ?? null),
    ];
}

function edr_spoken_note(PDO $pdo, string $id): ?array
{
    edr_ensure_tables($pdo);
    $stmt = $pdo->prepare('SELECT * FROM edr_spoken_notes WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? edr_spoken_note_row($row) : null;
}

function edr_spoken_notes(PDO $pdo, string $bookingId): array
{
    edr_ensure_tables($pdo);
    $stmt = $pdo->prepare('SELECT * FROM edr_spoken_notes WHERE booking_id = ? ORDER BY created_at DESC, id DESC LIMIT 50');
    $stmt->execute([$bookingId]);
    return array_map('edr_spoken_note_row', $stmt->fetchAll());
}

function edr_handle_admin_route(string $route, string $method): bool
{
    if ($route === '/admin/edr/status' && $method === 'GET') {
        require_admin();
        json_response(edr_status());
    }

    if ($route === '/admin/edr/transcribe' && $method === 'POST') {
        require_admin();
        try {
            json_response(edr_transcribe_uploaded_audio());
        } catch (Throwable $error) {
            json_response(['error' => $error->getMessage()], 400);
        }
    }

    if (!preg_match('#^/admin/bookings/([^/]+)/edr(?:/(sync|spoken-note))?$#', $route, $matches)) {
        return false;
    }

    require_admin();
    $pdo = db();
    edr_ensure_tables($pdo);
    $bookingId = (string) $matches[1];
    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$bookingId]);
    $row = $stmt->fetch();
    $booking = $row ? normalize_booking($row) : null;
    if (!$booking) {
        json_response(['error' => 'Nie znaleziono wizyty.'], 404);
    }

    $action = $matches[2] ?? '';
    if ($action === '' && $method === 'GET') {
        json_response([
            'status' => edr_status(),
            'link' => edr_booking_link($pdo, $bookingId),
            'spoken_notes' => edr_spoken_notes($pdo, $bookingId),
        ]);
    }

    if ($action === 'sync' && $method === 'POST') {
        $data = json_input();
        $patientId = trim((string) ($data['patient_id'] ?? $data['edr_patient_id'] ?? ''));
        json_response(edr_sync_booking($pdo, $booking, $patientId));
    }

    if ($action === 'spoken-note' && $method === 'POST') {
        $data = json_input();
        try {
            $note = edr_create_spoken_note($pdo, $booking, $data);
            json_response($note, 201);
        } catch (Throwable $error) {
            json_response(['error' => $error->getMessage()], 400);
        }
    }

    json_response(['error' => 'Not found'], 404);
}
