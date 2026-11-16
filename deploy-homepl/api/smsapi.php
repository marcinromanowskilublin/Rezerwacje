<?php
declare(strict_types=1);

function smsapi_configured(): bool
{
    global $config;
    return trim((string) ($config['smsapi_token'] ?? '')) !== '';
}

function smsapi_callback_configured(): bool
{
    global $config;
    return trim((string) ($config['smsapi_callback_token'] ?? '')) !== '';
}

function smsapi_normalize_phone(string $phone): ?string
{
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if (str_starts_with($digits, '00')) {
        $digits = substr($digits, 2);
    }
    if (strlen($digits) === 9) {
        $digits = '48' . $digits;
    } elseif (str_starts_with($digits, '0') && strlen($digits) === 10) {
        $digits = '48' . substr($digits, 1);
    }
    return preg_match('/^[1-9]\d{8,14}$/', $digits) ? $digits : null;
}

function smsapi_default_templates(): array
{
    return [
        'booking_created' => [
            'label' => 'Potwierdzenie rezerwacji',
            'message' => 'Dzień dobry {first_name}, termin wizyty u {office_name}: {date} o {time}. Zarządzanie wizytą: {manage_url}',
        ],
        'reminder_day_before' => [
            'label' => 'Przypomnienie dzień przed',
            'message' => 'Przypomnienie: jutro {date} o {time} jest wizyta u {office_name}. Jeśli nie możesz uczestniczyć, odwołaj termin: {manage_url}',
        ],
        'booking_cancelled' => [
            'label' => 'Anulowanie wizyty',
            'message' => 'Dzień dobry {first_name}, wizyta {date} o {time} została anulowana.',
        ],
        'booking_rescheduled' => [
            'label' => 'Zmiana terminu',
            'message' => 'Dzień dobry {first_name}, termin wizyty został zmieniony na {date} o {time}.',
        ],
        'custom' => [
            'label' => 'Własna wiadomość',
            'message' => 'Dzień dobry {first_name}, ',
        ],
    ];
}

function smsapi_templates(): array
{
    global $config;
    $templates = smsapi_default_templates();
    $custom = $config['smsapi_templates'] ?? [];
    if (is_array($custom)) {
        foreach ($custom as $id => $template) {
            if (!is_array($template)) {
                continue;
            }
            $id = preg_replace('/[^a-z0-9_-]+/', '_', strtolower((string) $id));
            if ($id === '') {
                continue;
            }
            $templates[$id] = [
                'label' => trim((string) ($template['label'] ?? $id)) ?: $id,
                'message' => trim((string) ($template['message'] ?? '')),
            ];
        }
    }
    return $templates;
}

function smsapi_booking_values(array $booking): array
{
    global $config;
    $name = trim((string) ($booking['patient_name'] ?? ''));
    $parts = preg_split('/\s+/', $name) ?: [];
    $date = (string) ($booking['booking_date'] ?? '');
    $time = hm((string) ($booking['start_time'] ?? ''));
    return [
        '{name}' => $name,
        '{first_name}' => $parts[0] ?? $name,
        '{date}' => $date,
        '{time}' => $time,
        '{phone}' => trim((string) ($booking['patient_phone'] ?? '')),
        '{email}' => trim((string) ($booking['patient_email'] ?? '')),
        '{office_name}' => trim((string) ($config['office_name'] ?? 'gabinetu')),
        '{manage_url}' => public_app_url('manage/' . rawurlencode((string) ($booking['management_token'] ?? ''))),
    ];
}

function smsapi_render_template(string $templateId, array $booking): ?array
{
    $templates = smsapi_templates();
    if (!isset($templates[$templateId])) {
        return null;
    }
    $template = $templates[$templateId];
    $message = strtr((string) ($template['message'] ?? ''), smsapi_booking_values($booking));
    return [
        'id' => $templateId,
        'label' => (string) ($template['label'] ?? $templateId),
        'message' => trim($message),
    ];
}

function smsapi_booking_templates(array $booking): array
{
    $rows = [];
    foreach (array_keys(smsapi_templates()) as $id) {
        $rendered = smsapi_render_template((string) $id, $booking);
        if ($rendered !== null) {
            $rows[] = $rendered;
        }
    }
    return $rows;
}

function smsapi_auto_enabled(string $event): bool
{
    global $config;
    $rules = $config['smsapi_auto'] ?? [];
    return is_array($rules) && !empty($rules[$event]);
}

function smsapi_send_booking_template(PDO $pdo, array $booking, string $templateId, string $purpose): array
{
    $rendered = smsapi_render_template($templateId, $booking);
    if ($rendered === null) {
        return ['ok' => false, 'error' => 'Nie znaleziono szablonu SMS.'];
    }
    return smsapi_send(
        $pdo,
        (string) ($booking['patient_phone'] ?? ''),
        (string) $rendered['message'],
        (string) ($booking['id'] ?? ''),
        $purpose
    );
}

function smsapi_send_auto(PDO $pdo, array $booking, string $event): void
{
    if (!smsapi_auto_enabled($event)) {
        return;
    }
    try {
        smsapi_send_booking_template($pdo, $booking, $event, $event);
    } catch (Throwable $error) {
        error_log('SMSAPI auto send failed: ' . $error->getMessage());
    }
}

function smsapi_run_day_before_reminders(PDO $pdo): array
{
    if (!smsapi_auto_enabled('reminder_day_before')) {
        return ['ok' => true, 'sent' => 0, 'skipped' => 0, 'enabled' => false];
    }
    $targetDate = date('Y-m-d', strtotime('+1 day') ?: time() + 86400);
    $stmt = $pdo->prepare(
        "SELECT *
         FROM bookings
         WHERE booking_date = ?
           AND status IN ('pending', 'pending_payment', 'confirmed')
         ORDER BY start_time ASC"
    );
    $stmt->execute([$targetDate]);
    $sent = 0;
    $skipped = 0;
    $exists = $pdo->prepare(
        "SELECT id FROM smsapi_messages
         WHERE booking_id = ? AND purpose = 'reminder_day_before'
         LIMIT 1"
    );
    foreach ($stmt->fetchAll() as $booking) {
        $exists->execute([(string) $booking['id']]);
        if ($exists->fetchColumn()) {
            $skipped++;
            continue;
        }
        $result = smsapi_send_booking_template($pdo, $booking, 'reminder_day_before', 'reminder_day_before');
        if (!empty($result['ok'])) {
            $sent++;
        } else {
            $skipped++;
        }
    }
    return ['ok' => true, 'sent' => $sent, 'skipped' => $skipped, 'date' => $targetDate, 'enabled' => true];
}

function smsapi_handle_reminders_route(string $method): void
{
    global $config;
    if ($method !== 'GET' && $method !== 'POST') {
        json_response(['error' => 'Method not allowed'], 405);
    }
    $expected = trim((string) ($config['smsapi_reminder_token'] ?? ''));
    $given = trim((string) ($_GET['token'] ?? $_SERVER['HTTP_X_SMSAPI_TOKEN'] ?? ''));
    if ($expected === '' || $given === '' || !hash_equals($expected, $given)) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    json_response(smsapi_run_day_before_reminders(db()));
}

/** Sends one SMS and stores only delivery metadata, not the message body. */
function smsapi_send(PDO $pdo, string $phone, string $message, ?string $bookingId = null, string $purpose = 'manual'): array
{
    global $config;
    $token = trim((string) ($config['smsapi_token'] ?? ''));
    $to = smsapi_normalize_phone($phone);
    $message = trim($message);
    $length = function_exists('mb_strlen') ? mb_strlen($message, 'UTF-8') : strlen($message);

    if ($token === '') {
        return ['ok' => false, 'error' => 'SMSAPI nie jest skonfigurowane.'];
    }
    if ($to === null) {
        return ['ok' => false, 'error' => 'Nieprawidłowy numer telefonu.'];
    }
    if ($message === '' || $length > 670) {
        return ['ok' => false, 'error' => 'Treść SMS musi mieć od 1 do 670 znaków.'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'Serwer PHP nie ma włączonego rozszerzenia cURL.'];
    }

    $callbackRef = bin2hex(random_bytes(16));
    $insert = $pdo->prepare(
        "INSERT INTO smsapi_messages (booking_id, callback_ref, purpose, status_name)
         VALUES (?, ?, ?, 'SUBMITTING')"
    );
    $insert->execute([$bookingId, $callbackRef, substr($purpose, 0, 32)]);
    $localId = (int) $pdo->lastInsertId();

    $params = [
        'to' => $to,
        'message' => $message,
        'format' => 'json',
        'encoding' => 'utf-8',
        'idx' => $callbackRef,
        'check_idx' => '1',
    ];
    $sender = trim((string) ($config['smsapi_sender'] ?? ''));
    if ($sender !== '') {
        $params['from'] = $sender;
    }

    $curl = curl_init('https://api.smsapi.pl/sms.do');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($params, '', '&', PHP_QUERY_RFC3986),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $raw = curl_exec($curl);
    $httpStatus = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_errno($curl);
    curl_close($curl);

    $response = is_string($raw) ? json_decode($raw, true) : null;
    $item = is_array($response) ? ($response['list'][0] ?? null) : null;
    $providerId = is_array($item) ? (string) ($item['id'] ?? '') : '';
    $providerStatus = is_array($item) ? (string) ($item['status'] ?? 'QUEUE') : '';
    if ($httpStatus >= 200 && $httpStatus < 300 && $providerId !== '') {
        $update = $pdo->prepare(
            'UPDATE smsapi_messages SET provider_message_id = ?, status_name = ?, submitted_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?'
        );
        $update->execute([$providerId, substr($providerStatus, 0, 32), $localId]);
        return ['ok' => true, 'message_id' => $providerId, 'status' => $providerStatus ?: 'QUEUE'];
    }

    $errorCode = is_array($response) ? (string) ($response['error'] ?? '') : '';
    $state = ($curlError !== 0 || $httpStatus === 0) ? 'UNKNOWN' : 'FAILED';
    $update = $pdo->prepare(
        'UPDATE smsapi_messages SET status_name = ?, provider_error_code = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?'
    );
    $update->execute([$state, substr($errorCode, 0, 32), $localId]);
    return ['ok' => false, 'error' => 'SMSAPI nie potwierdziło przyjęcia wiadomości. Sprawdź status przed ponowieniem.'];
}

function smsapi_callback_values($value): array
{
    if (is_array($value)) {
        return array_values($value);
    }
    if (!is_string($value) || $value === '') {
        return [];
    }
    return explode(',', $value);
}

function smsapi_handle_callback(string $method): bool
{
    global $config;
    if (!smsapi_callback_configured()) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Callback not configured';
        return true;
    }

    $givenToken = (string) ($_GET['key'] ?? '');
    $expectedToken = (string) $config['smsapi_callback_token'];
    if ($givenToken === '' || !hash_equals($expectedToken, $givenToken)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Forbidden';
        return true;
    }

    $allowedIps = (array) ($config['smsapi_callback_ips'] ?? []);
    $remoteIp = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($allowedIps && !in_array($remoteIp, $allowedIps, true)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Forbidden';
        return true;
    }

    if (!in_array($method, ['GET', 'POST'], true)) {
        http_response_code(405);
        header('Allow: GET, POST');
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Method not allowed';
        return true;
    }

    $input = $method === 'POST' ? array_merge($_GET, $_POST) : $_GET;
    $ids = smsapi_callback_values($input['MsgId'] ?? null);
    $statuses = smsapi_callback_values($input['status'] ?? null);
    $names = smsapi_callback_values($input['status_name'] ?? null);
    $refs = smsapi_callback_values($input['idx'] ?? null);
    $doneDates = smsapi_callback_values($input['donedate'] ?? null);

    if (!$ids || !$statuses || count($ids) > 5 || count($ids) !== count($statuses)) {
        http_response_code(400);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Invalid callback';
        return true;
    }

    try {
        $pdo = db();
        $byProviderId = $pdo->prepare(
            'UPDATE smsapi_messages SET status_code = ?, status_name = ?, delivered_at = ?, updated_at = UTC_TIMESTAMP() WHERE provider_message_id = ?'
        );
        $byRef = $pdo->prepare(
            'UPDATE smsapi_messages SET provider_message_id = COALESCE(provider_message_id, ?), status_code = ?, status_name = ?, delivered_at = ?, updated_at = UTC_TIMESTAMP() WHERE callback_ref = ?'
        );
        foreach ($ids as $index => $idValue) {
            $id = trim((string) $idValue);
            $status = trim((string) $statuses[$index]);
            if (!preg_match('/^[A-Za-z0-9_-]{1,32}$/', $id) || !preg_match('/^[A-Za-z0-9_-]{1,16}$/', $status)) {
                continue;
            }
            $name = substr(trim((string) ($names[$index] ?? '')), 0, 32);
            $epoch = (int) ($doneDates[$index] ?? 0);
            $deliveredAt = $epoch > 0 ? gmdate('Y-m-d H:i:s', $epoch) : null;
            $byProviderId->execute([$status, $name, $deliveredAt, $id]);
            if ($byProviderId->rowCount() === 0) {
                $ref = trim((string) ($refs[$index] ?? ''));
                if (preg_match('/^[a-f0-9]{32}$/', $ref)) {
                    $byRef->execute([$id, $status, $name, $deliveredAt, $ref]);
                }
            }
        }
    } catch (Throwable $error) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Retry';
        return true;
    }

    header('Content-Type: text/plain; charset=utf-8');
    echo 'OK';
    return true;
}
