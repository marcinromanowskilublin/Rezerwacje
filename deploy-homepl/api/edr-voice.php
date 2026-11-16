<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/mydr.php';
apply_api_cors();

const EDR_VOICE_MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const EDR_VOICE_ALLOWED_AUDIO_TYPES = [
    'audio/webm',
    'audio/ogg',
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp4',
    'video/webm',
];

function edr_voice_first_non_empty(...$values): string
{
    foreach ($values as $value) {
        $string = trim((string) $value);
        if ($string !== '') {
            return $string;
        }
    }
    return '';
}

function edr_voice_config(): array
{
    global $config;
    $edr = is_array($config['edr'] ?? null) ? $config['edr'] : [];
    $deepgram = is_array($config['deepgram'] ?? null) ? $config['deepgram'] : [];
    $configuredBase = (string) (
        $edr['base_url']
        ?? $config['edr_base_url']
        ?? $config['mydr_base_url']
        ?? getenv('EDR_BASE_URL')
        ?: 'https://edm.mydr.pl/secure/ext_api'
    );
    $configuredBase = rtrim($configuredBase, '/');
    if (substr($configuredBase, -15) !== '/secure/ext_api') {
        $configuredBase .= '/secure/ext_api';
    }
    $enabledValue = $edr['enabled'] ?? ($config['edr_enabled'] ?? ($config['mydr_enabled'] ?? getenv('EDR_ENABLED')));

    return [
        'enabled' => filter_var($enabledValue, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? false,
        'edr_base_url' => $configuredBase,
        'client_id' => trim((string) ($edr['client_id'] ?? $config['edr_client_id'] ?? $config['mydr_client_id'] ?? getenv('EDR_CLIENT_ID') ?: '')),
        'client_secret' => trim((string) ($edr['client_secret'] ?? $config['edr_client_secret'] ?? $config['mydr_client_secret'] ?? getenv('EDR_CLIENT_SECRET') ?: '')),
        'access_token' => trim((string) ($edr['access_token'] ?? $config['edr_access_token'] ?? getenv('EDR_ACCESS_TOKEN') ?: '')),
        'refresh_token' => trim((string) ($edr['refresh_token'] ?? $config['edr_refresh_token'] ?? $config['mydr_refresh_token'] ?? getenv('EDR_REFRESH_TOKEN') ?: '')),
        'token_file' => trim((string) ($edr['token_file'] ?? $config['edr_token_file'] ?? getenv('EDR_TOKEN_FILE') ?: '')),
        'doctor_id' => (int) edr_voice_first_non_empty(
            $edr['doctor_id'] ?? '',
            $config['edr_doctor_id'] ?? '',
            $config['mydr_doctor_id'] ?? '',
            getenv('EDR_DOCTOR_ID') ?: ''
        ),
        'office_id' => (int) edr_voice_first_non_empty(
            $edr['office_id'] ?? '',
            $config['edr_office_id'] ?? '',
            $config['mydr_office_id'] ?? '',
            getenv('EDR_OFFICE_ID') ?: ''
        ),
        'spoken_sync_enabled' => filter_var(
            $edr['spoken_note_sync_enabled']
                ?? ($config['edr_spoken_note_sync_enabled'] ?? getenv('EDR_SPOKEN_NOTE_SYNC_ENABLED')),
            FILTER_VALIDATE_BOOL,
            FILTER_NULL_ON_FAILURE
        ) ?? false,
        'deepgram_key' => trim((string) ($deepgram['api_key'] ?? $config['deepgram_api_key'] ?? getenv('DEEPGRAM_API_KEY') ?: '')),
        'deepgram_url' => rtrim((string) ($deepgram['base_url'] ?? $config['deepgram_base_url'] ?? getenv('DEEPGRAM_BASE_URL') ?: 'https://api.eu.deepgram.com'), '/'),
    ];
}

function edr_voice_token_file(array $settings): string
{
    if ($settings['token_file'] !== '') {
        return $settings['token_file'];
    }
    return secure_runtime_dir('edr-oauth') . DIRECTORY_SEPARATOR . 'tokens.json';
}

function edr_voice_read_tokens(array $settings): array
{
    $tokens = [
        'access_token' => $settings['access_token'],
        'refresh_token' => $settings['refresh_token'],
    ];
    $path = edr_voice_token_file($settings);
    if (!is_file($path)) {
        return $tokens;
    }
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) {
        return $tokens;
    }
    foreach (['access_token', 'refresh_token'] as $key) {
        if (!empty($decoded[$key]) && is_string($decoded[$key])) {
            $tokens[$key] = trim($decoded[$key]);
        }
    }
    return $tokens;
}

function edr_voice_write_tokens(array $settings, array $tokens): void
{
    $path = edr_voice_token_file($settings);
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Nie udało się utworzyć bezpiecznego magazynu tokenów EDR.');
    }
    $payload = json_encode([
        'access_token' => (string) ($tokens['access_token'] ?? ''),
        'refresh_token' => (string) ($tokens['refresh_token'] ?? ''),
        'updated_at' => gmdate('c'),
    ], JSON_UNESCAPED_SLASHES);
    $temporary = $path . '.tmp-' . bin2hex(random_bytes(6));
    if ($payload === false || file_put_contents($temporary, $payload, LOCK_EX) === false) {
        throw new RuntimeException('Nie udało się zapisać odświeżonych tokenów EDR.');
    }
    @chmod($temporary, 0600);
    if (!@rename($temporary, $path)) {
        @unlink($temporary);
        throw new RuntimeException('Nie udało się atomowo podmienić tokenów EDR.');
    }
}

function edr_voice_has_auth_tokens(array $settings): bool
{
    $tokens = edr_voice_read_tokens($settings);
    if ($tokens['access_token'] !== '' || $tokens['refresh_token'] !== '') {
        return true;
    }
    if (!function_exists('mydr_configured') || !mydr_configured()) {
        return false;
    }
    try {
        $row = mydr_token_row(db());
        return is_array($row)
            && (trim((string) ($row['access_token'] ?? '')) !== '' || trim((string) ($row['refresh_token'] ?? '')) !== '');
    } catch (Throwable $error) {
        error_log('EDR status token check failed: ' . $error->getMessage());
        return false;
    }
}

function edr_voice_curl(
    string $url,
    string $method,
    array $headers = [],
    ?string $body = null
): array {
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADER => false,
    ]);
    if ($body !== null) {
        curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
    }
    $raw = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = curl_error($handle);
    curl_close($handle);
    if ($raw === false || $error !== '') {
        throw new RuntimeException('Usługa zewnętrzna jest chwilowo niedostępna.');
    }
    return ['status' => $status, 'body' => (string) $raw];
}

function edr_voice_refresh_tokens(array $settings, string $refreshToken, ?string $staleAccess = null): array
{
    if ($settings['client_id'] === '' || $settings['client_secret'] === '' || $refreshToken === '') {
        throw new RuntimeException('Brak kompletu danych OAuth EDR.');
    }
    $tokenPath = edr_voice_token_file($settings);
    $tokenDir = dirname($tokenPath);
    if (!is_dir($tokenDir) && !mkdir($tokenDir, 0700, true) && !is_dir($tokenDir)) {
        throw new RuntimeException('Nie udało się utworzyć magazynu tokenów EDR.');
    }
    $lockPath = $tokenPath . '.lock';
    $lock = fopen($lockPath, 'c+');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) {
            fclose($lock);
        }
        throw new RuntimeException('Nie udało się zablokować rotacji tokenu EDR.');
    }
    @chmod($lockPath, 0600);
    try {
        $current = edr_voice_read_tokens($settings);
        if (
            $staleAccess !== null
            && $current['access_token'] !== ''
            && !hash_equals($staleAccess, $current['access_token'])
        ) {
            return $current;
        }
        $activeRefresh = $current['refresh_token'] !== '' ? $current['refresh_token'] : $refreshToken;
        $response = edr_voice_curl(
            $settings['edr_base_url'] . '/o/token/',
            'POST',
            ['Content-Type: application/x-www-form-urlencoded'],
            http_build_query([
                'grant_type' => 'refresh_token',
                'refresh_token' => $activeRefresh,
                'client_id' => $settings['client_id'],
                'client_secret' => $settings['client_secret'],
            ])
        );
        $decoded = json_decode($response['body'], true);
        if ($response['status'] < 200 || $response['status'] >= 300 || !is_array($decoded) || empty($decoded['access_token'])) {
            throw new RuntimeException('Nie udało się odświeżyć autoryzacji EDR.');
        }
        $tokens = [
            'access_token' => (string) $decoded['access_token'],
            'refresh_token' => (string) ($decoded['refresh_token'] ?? $activeRefresh),
        ];
        edr_voice_write_tokens($settings, $tokens);
        return $tokens;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function edr_voice_request(
    array $settings,
    string $path,
    string $method = 'GET',
    ?array $payload = null
): array {
    if (function_exists('mydr_configured') && mydr_configured()) {
        $response = mydr_api(db(), $method, ltrim($path, '/'), $payload);
        if ((int) $response['status'] < 200 || (int) $response['status'] >= 300) {
            throw new RuntimeException('EDR odrzucił operację (HTTP ' . (int) $response['status'] . ').');
        }
        return is_array($response['data']) ? $response['data'] : [];
    }

    $tokens = edr_voice_read_tokens($settings);
    if ($tokens['access_token'] === '' && $tokens['refresh_token'] !== '') {
        $tokens = edr_voice_refresh_tokens($settings, $tokens['refresh_token']);
    }
    if ($tokens['access_token'] === '') {
        throw new RuntimeException('Brak tokenu użytkownika EDR.');
    }

    $headers = [
        'Authorization: Bearer ' . $tokens['access_token'],
        'Accept: application/json',
    ];
    $body = null;
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    $response = edr_voice_curl(
        $settings['edr_base_url'] . '/' . ltrim($path, '/'),
        $method,
        $headers,
        $body
    );
    if ($response['status'] === 401 && $tokens['refresh_token'] !== '') {
        $tokens = edr_voice_refresh_tokens($settings, $tokens['refresh_token'], $tokens['access_token']);
        $headers[0] = 'Authorization: Bearer ' . $tokens['access_token'];
        $response = edr_voice_curl(
            $settings['edr_base_url'] . '/' . ltrim($path, '/'),
            $method,
            $headers,
            $body
        );
    }
    $decoded = json_decode($response['body'], true);
    if ($response['status'] < 200 || $response['status'] >= 300) {
        throw new RuntimeException('EDR odrzucił operację (HTTP ' . $response['status'] . ').');
    }
    return is_array($decoded) ? $decoded : [];
}

function edr_voice_normalize_name(string $value): string
{
    $value = mb_strtolower(trim($value), 'UTF-8');
    $value = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $value) ?: '';
    $parts = preg_split('/\s+/u', trim($value)) ?: [];
    sort($parts, SORT_STRING);
    return implode(' ', $parts);
}

function edr_voice_booking(string $bookingId): array
{
    if ($bookingId === '') {
        throw new InvalidArgumentException('Brak identyfikatora lokalnej wizyty.');
    }
    $stmt = db()->prepare(
        'SELECT id, booking_date, start_time, patient_name
         FROM bookings
         WHERE id = ?
         LIMIT 1'
    );
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();
    if (!is_array($booking)) {
        throw new InvalidArgumentException('Nie znaleziono lokalnej wizyty.');
    }
    return $booking;
}

function edr_voice_patient_name(array $patient): string
{
    $first = trim((string) ($patient['name'] ?? $patient['first_name'] ?? ''));
    $last = trim((string) ($patient['surname'] ?? $patient['last_name'] ?? ''));
    return trim($first . ' ' . $last);
}

function edr_voice_exact_booking_match(array $visit, array $patient, array $booking): bool
{
    $expectedDate = trim((string) ($booking['booking_date'] ?? ''));
    $expectedTime = substr(trim((string) ($booking['start_time'] ?? '')), 0, 5);
    $expectedName = trim((string) ($booking['patient_name'] ?? ''));
    return (string) ($visit['date'] ?? '') === $expectedDate
        && substr((string) ($visit['timeFrom'] ?? ''), 0, 5) === $expectedTime
        && edr_voice_normalize_name(edr_voice_patient_name($patient)) === edr_voice_normalize_name($expectedName);
}

function edr_voice_linked_candidate(array $settings, array $booking): ?array
{
    $bookingId = trim((string) ($booking['id'] ?? ''));
    if ($bookingId === '' || !mydr_configured()) {
        return null;
    }
    $pdo = db();
    $link = mydr_link($pdo, $bookingId);
    $visitId = (int) ($link['visit_id'] ?? 0);
    if ($visitId < 1) {
        return null;
    }
    $visit = edr_voice_request($settings, 'visits/' . $visitId . '/');
    $patient = edr_voice_request($settings, 'patients/' . (int) ($visit['patient'] ?? 0) . '/');
    $exact = edr_voice_exact_booking_match($visit, $patient, $booking);
    return [
        'visit_id' => $visitId,
        'patient_name' => edr_voice_patient_name($patient),
        'date' => (string) ($visit['date'] ?? ''),
        'time' => substr((string) ($visit['timeFrom'] ?? ''), 0, 5),
        'state' => (string) ($visit['state'] ?? ''),
        'exact_name_match' => $exact,
        'latest_modification' => (string) ($visit['latest_modification'] ?? ''),
    ];
}

function edr_voice_candidates(array $settings, array $booking): array
{
    $linked = edr_voice_linked_candidate($settings, $booking);
    if ($linked !== null) {
        return [$linked];
    }

    $date = trim((string) ($booking['booking_date'] ?? ''));
    $time = substr(trim((string) ($booking['start_time'] ?? '')), 0, 5);
    $patientName = trim((string) ($booking['patient_name'] ?? ''));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time) || $patientName === '') {
        throw new InvalidArgumentException('Brak kompletnych danych lokalnej wizyty.');
    }

    $query = http_build_query([
        'date_from' => $date,
        'date_to' => $date,
        'time_from' => $time,
        'time_to' => $time . ':59',
        'page_size' => 100,
    ]);
    $visits = edr_voice_request($settings, 'visits/?' . $query);
    $rows = [];
    foreach ((array) ($visits['results'] ?? []) as $visit) {
        if (!is_array($visit) || empty($visit['id']) || empty($visit['patient'])) {
            continue;
        }
        if (
            (int) ($visit['doctor'] ?? 0) !== $settings['doctor_id']
            || (int) ($visit['office'] ?? 0) !== $settings['office_id']
        ) {
            continue;
        }
        $visitTime = substr((string) ($visit['timeFrom'] ?? ''), 0, 5);
        if ($visitTime !== $time) {
            continue;
        }
        $patient = edr_voice_request($settings, 'patients/' . (int) $visit['patient'] . '/');
        $edrName = edr_voice_patient_name($patient);
        $rows[] = [
            'visit_id' => (int) $visit['id'],
            'patient_name' => $edrName,
            'date' => (string) ($visit['date'] ?? $date),
            'time' => $visitTime,
            'state' => (string) ($visit['state'] ?? ''),
            'exact_name_match' => edr_voice_normalize_name($edrName) === edr_voice_normalize_name($patientName),
            'latest_modification' => (string) ($visit['latest_modification'] ?? ''),
        ];
    }
    usort($rows, static fn(array $a, array $b): int => ((int) $b['exact_name_match']) <=> ((int) $a['exact_name_match']));
    return $rows;
}

function edr_voice_transcribe(array $settings): array
{
    if ($settings['deepgram_key'] === '') {
        throw new RuntimeException('Brak klucza Deepgram po stronie serwera.');
    }
    $rate = rate_limit_consume('edr-voice-transcribe', 12, 3600);
    if (empty($rate['allowed'])) {
        header('Retry-After: ' . (int) ($rate['retry_after'] ?? 60));
        json_response(['error' => 'Przekroczono limit transkrypcji. Spróbuj ponownie później.'], 429);
    }
    $upload = $_FILES['audio'] ?? null;
    if (!is_array($upload) || (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new InvalidArgumentException('Nie odebrano poprawnego nagrania.');
    }
    $size = (int) ($upload['size'] ?? 0);
    $tmp = (string) ($upload['tmp_name'] ?? '');
    if ($size < 1 || $size > EDR_VOICE_MAX_AUDIO_BYTES || !is_uploaded_file($tmp)) {
        throw new InvalidArgumentException('Nagranie jest puste albo przekracza limit 25 MB.');
    }
    $detectedMime = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $detectedMime = strtolower(trim((string) finfo_file($finfo, $tmp)));
            finfo_close($finfo);
        }
    }
    $mimeHeader = strtolower(trim((string) ($upload['type'] ?? '')));
    $mime = $detectedMime !== '' ? $detectedMime : trim(explode(';', $mimeHeader, 2)[0]);
    if (!in_array($mime, EDR_VOICE_ALLOWED_AUDIO_TYPES, true)) {
        throw new InvalidArgumentException('Nieobsługiwany format nagrania.');
    }
    $audio = file_get_contents($tmp);
    @unlink($tmp);
    if ($audio === false) {
        throw new RuntimeException('Nie udało się odczytać nagrania.');
    }
    $query = http_build_query([
        'model' => 'nova-3',
        'language' => 'pl',
        'smart_format' => 'true',
        'punctuate' => 'true',
        'paragraphs' => 'true',
        'mip_opt_out' => 'true',
    ]);
    $response = edr_voice_curl(
        $settings['deepgram_url'] . '/v1/listen?' . $query,
        'POST',
        [
            'Authorization: Token ' . $settings['deepgram_key'],
            'Content-Type: ' . $mime,
        ],
        $audio
    );
    $audio = '';
    $decoded = json_decode($response['body'], true);
    $transcript = trim((string) (
        $decoded['results']['channels'][0]['alternatives'][0]['paragraphs']['transcript']
        ?? $decoded['results']['channels'][0]['alternatives'][0]['transcript']
        ?? ''
    ));
    if ($response['status'] < 200 || $response['status'] >= 300 || $transcript === '') {
        throw new RuntimeException('Deepgram nie zwrócił transkrypcji nagrania.');
    }
    return ['transcript' => $transcript];
}

function edr_voice_save(array $settings, array $input): array
{
    $booking = edr_voice_booking(trim((string) ($input['booking_id'] ?? '')));
    $visitId = (int) ($input['visit_id'] ?? 0);
    $transcript = trim((string) ($input['transcript'] ?? ''));
    $expectedDate = trim((string) ($booking['booking_date'] ?? ''));
    $expectedTime = substr(trim((string) ($booking['start_time'] ?? '')), 0, 5);
    $expectedName = trim((string) ($booking['patient_name'] ?? ''));
    $expectedModification = trim((string) ($input['latest_modification'] ?? ''));
    $idempotencyKey = strtolower(trim((string) ($input['idempotency_key'] ?? '')));
    if ($visitId < 1 || $transcript === '' || mb_strlen($transcript, 'UTF-8') > 30000) {
        throw new InvalidArgumentException('Nieprawidłowy identyfikator wizyty albo treść wywiadu.');
    }
    if (!preg_match('/^[a-f0-9-]{20,64}$/', $idempotencyKey)) {
        throw new InvalidArgumentException('Brak poprawnego klucza idempotencji.');
    }
    $exactCandidates = array_values(array_filter(
        edr_voice_candidates($settings, $booking),
        static fn(array $candidate): bool => !empty($candidate['exact_name_match'])
    ));
    if (count($exactCandidates) !== 1 || (int) $exactCandidates[0]['visit_id'] !== $visitId) {
        throw new RuntimeException('Nie można jednoznacznie powiązać lokalnej wizyty z wizytą EDR.');
    }

    $visit = edr_voice_request($settings, 'visits/' . $visitId . '/');
    $patient = edr_voice_request($settings, 'patients/' . (int) ($visit['patient'] ?? 0) . '/');
    $actualName = edr_voice_patient_name($patient);
    if (
        (string) ($visit['date'] ?? '') !== $expectedDate
        || substr((string) ($visit['timeFrom'] ?? ''), 0, 5) !== $expectedTime
        || edr_voice_normalize_name($actualName) !== edr_voice_normalize_name($expectedName)
    ) {
        throw new RuntimeException('Wybrana wizyta EDR nie odpowiada danym pacjenta i terminu.');
    }
    if ($expectedModification !== '' && (string) ($visit['latest_modification'] ?? '') !== $expectedModification) {
        throw new RuntimeException('Wizyta EDR została w międzyczasie zmieniona. Odśwież kandydatów.');
    }

    $existing = trim((string) ($visit['interview'] ?? ''));
    $marker = '[Dyktowanie ' . gmdate('Y-m-d H:i') . ' UTC; id=' . $idempotencyKey . ']';
    if (strpos($existing, 'id=' . $idempotencyKey . ']') !== false) {
        return [
            'ok' => true,
            'already_saved' => true,
            'visit_id' => $visitId,
            'latest_modification' => (string) ($visit['latest_modification'] ?? ''),
        ];
    }
    $updated = $existing === '' ? $marker . "\n" . $transcript : $existing . "\n\n" . $marker . "\n" . $transcript;
    if (mb_strlen($updated, 'UTF-8') > 32768) {
        throw new RuntimeException('Pole wywiadu w EDR przekroczyłoby limit 32768 znaków.');
    }
    $saved = edr_voice_request($settings, 'visits/' . $visitId . '/', 'PATCH', ['interview' => $updated]);
    return [
        'ok' => true,
        'visit_id' => (int) ($saved['id'] ?? $visitId),
        'latest_modification' => (string) ($saved['latest_modification'] ?? ''),
    ];
}

function edr_voice_handle(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    require_admin();
    $settings = edr_voice_config();
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $action = trim((string) ($_GET['action'] ?? $_POST['action'] ?? 'status'));

    try {
        if ($method === 'GET' && $action === 'status') {
            $hasAuthTokens = edr_voice_has_auth_tokens($settings);
            json_response([
                'enabled' => $settings['enabled'],
                'configured' => $settings['enabled']
                    && $settings['client_id'] !== ''
                    && $settings['client_secret'] !== ''
                    && $hasAuthTokens
                    && $settings['doctor_id'] > 0
                    && $settings['office_id'] > 0
                    && $settings['deepgram_key'] !== '',
                'eu_processing' => strpos($settings['deepgram_url'], 'api.eu.deepgram.com') !== false,
                'zero_retention_requested' => true,
            ]);
        }
        if (!$settings['enabled']) {
            json_response(['error' => 'Integracja EDR jest wyłączona w konfiguracji serwera.'], 503);
        }
        if ($method === 'POST' && $action === 'transcribe') {
            json_response(edr_voice_transcribe($settings));
        }
        if ($method === 'POST' && $action === 'candidates') {
            $input = json_input();
            $booking = edr_voice_booking(trim((string) ($input['booking_id'] ?? '')));
            json_response(['candidates' => edr_voice_candidates($settings, $booking)]);
        }
        if ($method === 'POST' && $action === 'save') {
            if (!$settings['spoken_sync_enabled']) {
                json_response(['error' => 'Zapis transkrypcji do EDR nie został włączony w konfiguracji.'], 503);
            }
            json_response(edr_voice_save($settings, json_input()));
        }
        json_response(['error' => 'Not found'], 404);
    } catch (InvalidArgumentException $error) {
        json_response(['error' => $error->getMessage()], 422);
    } catch (Throwable $error) {
        error_log('EDR voice error: ' . $error->getMessage());
        json_response(['error' => $error->getMessage()], 502);
    }
}

if (!defined('EDR_VOICE_TESTING')) {
    edr_voice_handle();
}
