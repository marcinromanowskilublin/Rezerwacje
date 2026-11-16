<?php
declare(strict_types=1);

function payment_gateway_enabled(): bool
{
    global $config;
    return !empty($config['payment_gateway_enabled']);
}

function payment_gateway_provider(): string
{
    global $config;
    return strtolower(trim((string) ($config['payment_gateway_provider'] ?? 'payu')));
}

function payment_gateway_configured(): bool
{
    global $config;
    if (!payment_gateway_enabled()) {
        return false;
    }
    if (payment_gateway_provider() === 'payu') {
        return trim((string) ($config['payu_pos_id'] ?? '')) !== ''
            && trim((string) ($config['payu_client_id'] ?? '')) !== ''
            && trim((string) ($config['payu_client_secret'] ?? '')) !== ''
            && trim((string) ($config['payu_second_key'] ?? '')) !== '';
    }
    if (payment_gateway_provider() === 'przelewy24') {
        return (int) ($config['przelewy24_merchant_id'] ?? 0) > 0
            && (int) ($config['przelewy24_pos_id'] ?? 0) > 0
            && trim((string) ($config['przelewy24_api_key'] ?? '')) !== ''
            && trim((string) ($config['przelewy24_crc'] ?? '')) !== '';
    }
    return false;
}

function payment_gateway_status(): array
{
    global $config;
    return [
        'enabled' => payment_gateway_enabled(),
        'configured' => payment_gateway_configured(),
        'provider' => payment_gateway_provider(),
        'environment' => strtolower(trim((string) ($config['payment_gateway_environment'] ?? $config['payu_environment'] ?? 'sandbox'))) === 'production'
            ? 'production'
            : 'sandbox',
    ];
}

function payments_fetch_booking_by_token(PDO $pdo, string $token): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE management_token = ?');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    return $row ? normalize_booking($row) : null;
}

function payments_fetch_booking_by_id(PDO $pdo, string $id): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? normalize_booking($row) : null;
}

function payments_visit_type(PDO $pdo, array $booking): ?array
{
    $visitTypeId = (string) ($booking['visit_type_id'] ?? '');
    return $visitTypeId !== '' ? visit_type($pdo, $visitTypeId, false) : null;
}

function payments_booking_requires_payment(PDO $pdo, array $booking): bool
{
    $visitType = payments_visit_type($pdo, $booking);
    return (string) ($visitType['payment_policy'] ?? 'optional') === 'required'
        && (string) ($booking['payment_status'] ?? 'unpaid') !== 'paid';
}

function payments_booking_amount_grosz(PDO $pdo, array $booking): int
{
    $visitType = payments_visit_type($pdo, $booking);
    $amount = (float) ($visitType['price'] ?? 0);
    return max(0, (int) round($amount * 100));
}

function payments_public_api_url(string $path): string
{
    global $config;
    $base = rtrim(trim((string) ($config['public_base_url'] ?? '')), '/');
    if ($base === '') {
        $https = request_is_https();
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $base = ($https ? 'https' : 'http') . '://' . $host;
    }
    return $base . '/rezerwacja/api/' . ltrim($path, '/');
}

function payments_sha384_sign(array $payload): string
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return hash('sha384', (string) $json);
}

function payments_p24_base_url(): string
{
    global $config;
    return strtolower(trim((string) ($config['przelewy24_environment'] ?? 'sandbox'))) === 'production'
        ? 'https://secure.przelewy24.pl'
        : 'https://sandbox.przelewy24.pl';
}

function payments_p24_post(string $path, array $body): array
{
    global $config;
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'Serwer PHP nie ma włączonego rozszerzenia cURL.'];
    }

    $url = rtrim(payments_p24_base_url(), '/') . '/' . ltrim($path, '/');
    $payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERPWD => (int) ($config['przelewy24_pos_id'] ?? 0) . ':' . (string) ($config['przelewy24_api_key'] ?? ''),
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/json',
        ],
    ]);

    $raw = curl_exec($curl);
    $errno = curl_errno($curl);
    $error = curl_error($curl);
    $http = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if ($errno !== 0 || $raw === false) {
        return ['ok' => false, 'http_code' => $http, 'error' => $error ?: 'Błąd połączenia z Przelewy24.'];
    }

    $decoded = json_decode((string) $raw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'http_code' => $http, 'error' => 'Nieprawidłowa odpowiedź Przelewy24.'];
    }

    $hasError = isset($decoded['error']) || isset($decoded['errors']);
    return [
        'ok' => $http >= 200 && $http < 300 && !$hasError,
        'http_code' => $http,
        'payload' => $decoded,
        'error' => is_string($decoded['error'] ?? null) ? $decoded['error'] : null,
    ];
}

function payments_create_local_payment(PDO $pdo, array $booking, int $amountGrosz, string $currency, string $provider): string
{
    $paymentId = 'pay_' . bin2hex(random_bytes(12));
    $stmt = $pdo->prepare(
        "INSERT INTO payments (id, booking_id, provider, payment_method, amount, currency, status)
         VALUES (?, ?, ?, 'online', ?, ?, 'pending')"
    );
    $stmt->execute([
        $paymentId,
        (string) $booking['id'],
        $provider,
        number_format($amountGrosz / 100, 2, '.', ''),
        $currency,
    ]);
    return $paymentId;
}

function payments_open_attempt_minutes(): int
{
    global $config;
    return max(1, min(99, (int) ($config['payment_time_limit_minutes'] ?? 30)));
}

function payments_gateway_may_have_created_order(array $result): bool
{
    $http = (int) ($result['http_code'] ?? 0);
    return $http === 0 || ($http >= 200 && $http < 400) || $http >= 500;
}

function payments_attempt_is_recent(array $payment): bool
{
    $created = strtotime((string) ($payment['created_at'] ?? ''));
    return $created !== false && $created >= time() - payments_open_attempt_minutes() * 60;
}

function payments_find_open_attempt(PDO $pdo, array $booking, int $amountGrosz, string $currency, string $provider): ?array
{
    $stmt = $pdo->prepare(
        "SELECT *
         FROM payments
         WHERE booking_id = ?
           AND provider = ?
           AND payment_method = 'online'
           AND status = 'pending'
           AND amount = ?
           AND currency = ?
           AND (
             created_at >= DATE_SUB(NOW(), INTERVAL " . payments_open_attempt_minutes() . " MINUTE)
             OR (? = 'przelewy24' AND external_payment_id LIKE 'order:%')
           )
         ORDER BY created_at DESC
         LIMIT 1"
    );
    $stmt->execute([
        (string) $booking['id'],
        $provider,
        number_format($amountGrosz / 100, 2, '.', ''),
        $currency,
        $provider,
    ]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function payments_open_attempt_response(array $payment): array
{
    $provider = (string) ($payment['provider'] ?? '');
    $externalId = (string) ($payment['external_payment_id'] ?? '');
    $checkoutUrl = trim((string) ($payment['checkout_url'] ?? ''));
    if ($provider === 'przelewy24' && substr($externalId, 0, 6) === 'order:') {
        return [
            'ok' => false,
            'status' => 'pending',
            'http_status' => 409,
            'error' => 'Płatność jest już przekazana do weryfikacji. Zaczekaj chwilę na potwierdzenie z Przelewy24.',
        ];
    }
    if ($checkoutUrl !== '' && payments_attempt_is_recent($payment)) {
        return [
            'ok' => true,
            'status' => 'pending',
            'payment_id' => (string) $payment['id'],
            'payment_url' => $checkoutUrl,
            'reused' => true,
        ];
    }
    if ($provider === 'przelewy24' && substr($externalId, 0, 6) === 'token:' && payments_attempt_is_recent($payment)) {
        return [
            'ok' => true,
            'status' => 'pending',
            'payment_id' => (string) $payment['id'],
            'payment_url' => rtrim(payments_p24_base_url(), '/') . '/trnRequest/' . rawurlencode(substr($externalId, 6)),
            'reused' => true,
        ];
    }
    if ($provider === 'payu' && substr($externalId, 0, 9) === 'checkout:' && payments_attempt_is_recent($payment)) {
        return [
            'ok' => true,
            'status' => 'pending',
            'payment_id' => (string) $payment['id'],
            'payment_url' => rawurldecode(substr($externalId, 9)),
            'reused' => true,
        ];
    }
    return [
        'ok' => false,
        'status' => 'pending',
        'http_status' => 409,
        'error' => 'Płatność już została rozpoczęta. Wróć do ostatniego linku płatności albo spróbuj ponownie za kilka minut.',
    ];
}

function payments_mark_booking_payment_pending(PDO $pdo, array $booking): void
{
    $requiresPayment = payments_booking_requires_payment($pdo, $booking);
    $stmt = $pdo->prepare(
        "UPDATE bookings
         SET payment_status = 'pending',
             status = CASE WHEN ? = 1 AND status = 'pending' THEN 'pending_payment' ELSE status END
         WHERE id = ?
           AND status NOT IN ('cancelled', 'completed', 'no_show')
           AND payment_status != 'paid'"
    );
    $stmt->execute([$requiresPayment ? 1 : 0, (string) $booking['id']]);
}

function payments_register_przelewy24(PDO $pdo, array $booking): array
{
    global $config;
    if (!payment_gateway_configured()) {
        return ['ok' => false, 'error' => 'Bramka płatnicza nie jest skonfigurowana.'];
    }
    if (in_array((string) ($booking['status'] ?? ''), ['cancelled', 'completed', 'no_show'], true)) {
        return ['ok' => false, 'error' => 'Dla tej wizyty nie można uruchomić płatności.'];
    }
    if ((string) ($booking['payment_status'] ?? 'unpaid') === 'paid') {
        return ['ok' => true, 'status' => 'paid'];
    }

    $amountGrosz = payments_booking_amount_grosz($pdo, $booking);
    $currency = 'PLN';
    if ($amountGrosz <= 0) {
        return ['ok' => false, 'error' => 'Brak kwoty do płatności.'];
    }

    $openAttempt = payments_find_open_attempt($pdo, $booking, $amountGrosz, $currency, 'przelewy24');
    if ($openAttempt !== null) {
        return payments_open_attempt_response($openAttempt);
    }

    $merchantId = (int) ($config['przelewy24_merchant_id'] ?? 0);
    $posId = (int) ($config['przelewy24_pos_id'] ?? 0);
    $crc = trim((string) ($config['przelewy24_crc'] ?? ''));
    $paymentId = payments_create_local_payment($pdo, $booking, $amountGrosz, $currency, 'przelewy24');
    $description = 'Konsultacja online ' . (string) ($booking['booking_date'] ?? '') . ' ' . hm((string) ($booking['start_time'] ?? ''));

    $body = [
        'merchantId' => $merchantId,
        'posId' => $posId,
        'sessionId' => $paymentId,
        'amount' => $amountGrosz,
        'currency' => $currency,
        'description' => trim($description),
        'email' => (string) ($booking['patient_email'] ?? ''),
        'client' => (string) ($booking['patient_name'] ?? ''),
        'country' => 'PL',
        'phone' => preg_replace('/\D+/', '', (string) ($booking['patient_phone'] ?? '')) ?: '',
        'language' => 'pl',
        'urlReturn' => public_app_url('manage/' . rawurlencode((string) ($booking['management_token'] ?? '')) . '?payment=return'),
        'urlStatus' => payments_public_api_url('payments/przelewy24/status'),
        'timeLimit' => payments_open_attempt_minutes(),
        'channel' => (int) ($config['przelewy24_channel'] ?? 16),
        'waitForResult' => true,
    ];
    $body['sign'] = payments_sha384_sign([
        'sessionId' => $paymentId,
        'merchantId' => $merchantId,
        'amount' => $amountGrosz,
        'currency' => $currency,
        'crc' => $crc,
    ]);

    $result = payments_p24_post('/api/v1/transaction/register', $body);
    $payload = $result['payload'] ?? [];
    $token = is_array($payload) ? (string) ($payload['data']['token'] ?? $payload['token'] ?? '') : '';
    if ($token === '') {
        if (payments_gateway_may_have_created_order($result)) {
            payments_mark_booking_payment_pending($pdo, $booking);
            error_log('Przelewy24 register uncertain: ' . json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            return ['ok' => false, 'http_status' => 502, 'error' => 'Nie udało się potwierdzić linku płatności. Spróbuj ponownie za chwilę.'];
        }
        $pdo->prepare("UPDATE payments SET status = 'failed' WHERE id = ? AND status != 'paid'")->execute([$paymentId]);
        $pdo->prepare("UPDATE bookings SET payment_status = 'failed' WHERE id = ? AND payment_status != 'paid' AND status NOT IN ('cancelled', 'completed', 'no_show')")->execute([(string) $booking['id']]);
        error_log('Przelewy24 register failed: ' . json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return ['ok' => false, 'error' => 'Nie udało się rozpocząć płatności.'];
    }

    $checkoutUrl = rtrim(payments_p24_base_url(), '/') . '/trnRequest/' . rawurlencode($token);
    $pdo->prepare('UPDATE payments SET external_payment_id = ?, checkout_url = ?, status = ? WHERE id = ?')->execute(['token:' . $token, $checkoutUrl, 'pending', $paymentId]);
    payments_mark_booking_payment_pending($pdo, $booking);

    return [
        'ok' => true,
        'status' => 'pending',
        'payment_id' => $paymentId,
        'payment_url' => $checkoutUrl,
    ];
}

function payments_payu_base_url(): string
{
    global $config;
    return strtolower(trim((string) ($config['payu_environment'] ?? $config['payment_gateway_environment'] ?? 'sandbox'))) === 'production'
        ? 'https://secure.payu.com'
        : 'https://secure.snd.payu.com';
}

function payments_payu_form_post(string $path, array $fields): array
{
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'Serwer PHP nie ma włączonego rozszerzenia cURL.'];
    }

    $curl = curl_init(rtrim(payments_payu_base_url(), '/') . '/' . ltrim($path, '/'));
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields, '', '&', PHP_QUERY_RFC3986),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/x-www-form-urlencoded',
        ],
    ]);
    $raw = curl_exec($curl);
    $errno = curl_errno($curl);
    $error = curl_error($curl);
    $http = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if ($errno !== 0 || $raw === false) {
        return ['ok' => false, 'http_code' => $http, 'error' => $error ?: 'Błąd połączenia z PayU.'];
    }
    $decoded = json_decode((string) $raw, true);
    return [
        'ok' => $http >= 200 && $http < 300 && is_array($decoded),
        'http_code' => $http,
        'payload' => is_array($decoded) ? $decoded : null,
        'error' => is_array($decoded) && is_string($decoded['error_description'] ?? null) ? $decoded['error_description'] : null,
    ];
}

function payments_payu_json_post(string $path, array $body, string $accessToken): array
{
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'Serwer PHP nie ma włączonego rozszerzenia cURL.'];
    }

    $headers = [];
    $curl = curl_init(rtrim(payments_payu_base_url(), '/') . '/' . ltrim($path, '/'));
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$headers): int {
            $length = strlen($header);
            $parts = explode(':', $header, 2);
            if (count($parts) === 2) {
                $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return $length;
        },
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
        ],
    ]);
    $raw = curl_exec($curl);
    $errno = curl_errno($curl);
    $error = curl_error($curl);
    $http = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if ($errno !== 0 || $raw === false) {
        return ['ok' => false, 'http_code' => $http, 'error' => $error ?: 'Błąd połączenia z PayU.'];
    }
    $decoded = json_decode((string) $raw, true);
    return [
        'ok' => ($http >= 200 && $http < 300) || $http === 302,
        'http_code' => $http,
        'headers' => $headers,
        'payload' => is_array($decoded) ? $decoded : null,
        'error' => is_array($decoded) && is_string($decoded['status']['statusDesc'] ?? null) ? $decoded['status']['statusDesc'] : null,
    ];
}

function payments_payu_access_token(): array
{
    global $config;
    $result = payments_payu_form_post('/pl/standard/user/oauth/authorize', [
        'grant_type' => 'client_credentials',
        'client_id' => trim((string) ($config['payu_client_id'] ?? '')),
        'client_secret' => trim((string) ($config['payu_client_secret'] ?? '')),
    ]);
    $payload = $result['payload'] ?? [];
    $token = is_array($payload) ? (string) ($payload['access_token'] ?? '') : '';
    if (empty($result['ok']) || $token === '') {
        return ['ok' => false, 'error' => (string) ($result['error'] ?? 'Nie udało się pobrać tokenu PayU.')];
    }
    return ['ok' => true, 'token' => $token];
}

function payments_split_name_for_payu(string $fullName): array
{
    $fullName = trim((string) preg_replace('/\s+/u', ' ', $fullName));
    if ($fullName === '') {
        return ['first' => '', 'last' => ''];
    }
    $parts = preg_split('/\s+/u', $fullName) ?: [];
    $first = array_shift($parts) ?? $fullName;
    return ['first' => $first, 'last' => implode(' ', $parts)];
}

function payments_register_payu(PDO $pdo, array $booking): array
{
    global $config;
    if (!payment_gateway_configured() || payment_gateway_provider() !== 'payu') {
        return ['ok' => false, 'error' => 'PayU nie jest skonfigurowane.'];
    }
    if (in_array((string) ($booking['status'] ?? ''), ['cancelled', 'completed', 'no_show'], true)) {
        return ['ok' => false, 'error' => 'Dla tej wizyty nie można uruchomić płatności.'];
    }
    if ((string) ($booking['payment_status'] ?? 'unpaid') === 'paid') {
        return ['ok' => true, 'status' => 'paid'];
    }

    $amountGrosz = payments_booking_amount_grosz($pdo, $booking);
    if ($amountGrosz <= 0) {
        return ['ok' => false, 'error' => 'Brak kwoty do płatności.'];
    }
    $currency = 'PLN';
    $openAttempt = payments_find_open_attempt($pdo, $booking, $amountGrosz, $currency, 'payu');
    if ($openAttempt !== null) {
        return payments_open_attempt_response($openAttempt);
    }

    $paymentId = payments_create_local_payment($pdo, $booking, $amountGrosz, $currency, 'payu');
    $token = payments_payu_access_token();
    if (empty($token['ok'])) {
        $pdo->prepare("UPDATE payments SET status = 'failed' WHERE id = ? AND status != 'paid'")->execute([$paymentId]);
        return ['ok' => false, 'error' => (string) ($token['error'] ?? 'Nie udało się połączyć z PayU.')];
    }

    $name = payments_split_name_for_payu((string) ($booking['patient_name'] ?? ''));
    $description = 'Konsultacja online ' . (string) ($booking['booking_date'] ?? '') . ' ' . hm((string) ($booking['start_time'] ?? ''));
    $body = [
        'notifyUrl' => payments_public_api_url('payments/payu/notify'),
        'continueUrl' => public_app_url('manage/' . rawurlencode((string) ($booking['management_token'] ?? '')) . '?payment=return'),
        'customerIp' => request_client_ip() !== 'unknown' ? request_client_ip() : '127.0.0.1',
        'merchantPosId' => trim((string) ($config['payu_pos_id'] ?? '')),
        'description' => $description,
        'visibleDescription' => substr($description, 0, 80),
        'extOrderId' => $paymentId,
        'currencyCode' => $currency,
        'totalAmount' => (string) $amountGrosz,
        'validityTime' => payments_open_attempt_minutes() * 60,
        'buyer' => [
            'email' => (string) ($booking['patient_email'] ?? ''),
            'phone' => preg_replace('/\D+/', '', (string) ($booking['patient_phone'] ?? '')) ?: '',
            'firstName' => $name['first'],
            'lastName' => $name['last'],
            'language' => 'pl',
        ],
        'products' => [[
            'name' => 'Konsultacja online',
            'unitPrice' => (string) $amountGrosz,
            'quantity' => '1',
        ]],
    ];

    $result = payments_payu_json_post('/api/v2_1/orders', $body, (string) $token['token']);
    $payload = $result['payload'] ?? [];
    $redirectUri = is_array($payload) ? (string) ($payload['redirectUri'] ?? '') : '';
    $orderId = is_array($payload) ? (string) ($payload['orderId'] ?? '') : '';
    if ($redirectUri === '' && !empty($result['headers']['location'])) {
        $redirectUri = (string) $result['headers']['location'];
    }
    if (empty($result['ok']) || $redirectUri === '') {
        if ($orderId !== '' || payments_gateway_may_have_created_order($result)) {
            $externalId = $orderId !== '' ? 'order:' . $orderId : 'redirect:' . substr(hash('sha256', json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: $paymentId), 0, 32);
            $pdo->prepare('UPDATE payments SET external_payment_id = ?, status = ? WHERE id = ? AND status != ?')->execute([$externalId, 'pending', $paymentId, 'paid']);
            payments_mark_booking_payment_pending($pdo, $booking);
            error_log('PayU order create uncertain: ' . json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            return ['ok' => false, 'http_status' => 502, 'error' => 'Nie udało się potwierdzić linku płatności PayU. Spróbuj ponownie za chwilę.'];
        }
        $pdo->prepare("UPDATE payments SET status = 'failed' WHERE id = ? AND status != 'paid'")->execute([$paymentId]);
        $pdo->prepare("UPDATE bookings SET payment_status = 'failed' WHERE id = ? AND payment_status != 'paid' AND status NOT IN ('cancelled', 'completed', 'no_show')")->execute([(string) $booking['id']]);
        error_log('PayU order create failed: ' . json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return ['ok' => false, 'error' => 'Nie udało się rozpocząć płatności PayU.'];
    }

    $externalId = $orderId !== '' ? 'order:' . $orderId : 'redirect:' . substr(hash('sha256', $redirectUri), 0, 32);
    $pdo->prepare('UPDATE payments SET external_payment_id = ?, checkout_url = ?, status = ? WHERE id = ?')->execute([$externalId, $redirectUri, 'pending', $paymentId]);
    payments_mark_booking_payment_pending($pdo, $booking);

    return [
        'ok' => true,
        'status' => 'pending',
        'payment_id' => $paymentId,
        'payment_url' => $redirectUri,
    ];
}

function payments_parse_payu_signature(string $header): array
{
    $result = [];
    foreach (explode(';', $header) as $part) {
        $pieces = explode('=', trim($part), 2);
        if (count($pieces) === 2) {
            $result[strtolower(trim($pieces[0]))] = trim($pieces[1]);
        }
    }
    return $result;
}

function payments_hash_algorithm(string $algorithm): ?string
{
    $normalized = strtolower(str_replace(['-', '_'], '', $algorithm));
    if ($normalized === 'md5') {
        return 'md5';
    }
    if ($normalized === 'sha256') {
        return 'sha256';
    }
    if ($normalized === 'sha384') {
        return 'sha384';
    }
    if ($normalized === 'sha512') {
        return 'sha512';
    }
    return null;
}

function payments_verify_payu_signature(string $rawBody): bool
{
    global $config;
    $header = (string) ($_SERVER['HTTP_OPENPAYU_SIGNATURE'] ?? $_SERVER['HTTP_X_OPENPAYU_SIGNATURE'] ?? '');
    $signature = payments_parse_payu_signature($header);
    $incoming = (string) ($signature['signature'] ?? '');
    $algorithm = payments_hash_algorithm((string) ($signature['algorithm'] ?? 'MD5'));
    if ($incoming === '' || $algorithm === null) {
        return false;
    }
    $expected = hash($algorithm, $rawBody . trim((string) ($config['payu_second_key'] ?? '')));
    return hash_equals($expected, $incoming);
}

function payments_handle_payu_notification(PDO $pdo, string $rawBody, array $data): array
{
    if (!payment_gateway_configured() || payment_gateway_provider() !== 'payu') {
        return ['ok' => false, 'error' => 'PayU nie jest skonfigurowane.'];
    }
    if (!payments_verify_payu_signature($rawBody)) {
        return ['ok' => false, 'error' => 'Nieprawidłowy podpis notyfikacji PayU.'];
    }

    $order = is_array($data['order'] ?? null) ? $data['order'] : [];
    $paymentId = (string) ($order['extOrderId'] ?? '');
    $status = (string) ($order['status'] ?? '');
    $orderId = (string) ($order['orderId'] ?? '');
    $amount = (int) ($order['totalAmount'] ?? 0);
    $currency = (string) ($order['currencyCode'] ?? 'PLN');
    if ($paymentId === '' || $status === '') {
        return ['ok' => false, 'error' => 'Niepełna notyfikacja PayU.'];
    }

    $stmt = $pdo->prepare('SELECT * FROM payments WHERE id = ? AND provider = ? LIMIT 1');
    $stmt->execute([$paymentId, 'payu']);
    $payment = $stmt->fetch();
    if (!$payment) {
        return ['ok' => false, 'error' => 'Nie znaleziono lokalnej płatności PayU.'];
    }
    $localAmount = (int) round(((float) $payment['amount']) * 100);
    if ($amount > 0 && ($localAmount !== $amount || (string) ($payment['currency'] ?? 'PLN') !== $currency)) {
        return ['ok' => false, 'error' => 'Kwota płatności PayU nie zgadza się z rezerwacją.'];
    }

    $bookingStmt = $pdo->prepare('SELECT id, status, payment_status FROM bookings WHERE id = ? LIMIT 1');
    $bookingStmt->execute([(string) $payment['booking_id']]);
    $booking = $bookingStmt->fetch();
    if (!$booking) {
        return ['ok' => false, 'error' => 'Nie znaleziono rezerwacji dla płatności PayU.'];
    }

    if ($status === 'COMPLETED') {
        $pdo->prepare("UPDATE payments SET status = 'paid', external_payment_id = ?, paid_at = NOW() WHERE id = ?")
            ->execute([$orderId !== '' ? 'order:' . $orderId : (string) ($payment['external_payment_id'] ?? ''), $paymentId]);
        if ((string) ($booking['status'] ?? '') === 'cancelled') {
            return ['ok' => true, 'booking_cancelled' => true];
        }
        $pdo->prepare(
            "UPDATE bookings
             SET payment_status = 'paid',
                 status = CASE WHEN status = 'pending_payment' THEN 'confirmed' ELSE status END
             WHERE id = ? AND status != 'cancelled'"
        )->execute([(string) $payment['booking_id']]);
        mydr_sync_after_response((string) $payment['booking_id']);
        return ['ok' => true];
    }

    if ((string) ($payment['status'] ?? '') === 'paid') {
        return ['ok' => true, 'already_paid' => true];
    }

    if (in_array($status, ['CANCELED', 'REJECTED'], true)) {
        $pdo->prepare("UPDATE payments SET status = 'failed', external_payment_id = ? WHERE id = ? AND status != 'paid'")
            ->execute([$orderId !== '' ? 'order:' . $orderId : (string) ($payment['external_payment_id'] ?? ''), $paymentId]);
        $pdo->prepare("UPDATE bookings SET payment_status = 'failed' WHERE id = ? AND payment_status != 'paid' AND status NOT IN ('cancelled', 'completed', 'no_show')")
            ->execute([(string) $payment['booking_id']]);
        return ['ok' => true];
    }

    $pdo->prepare("UPDATE payments SET status = 'pending', external_payment_id = ? WHERE id = ? AND status != 'paid'")
        ->execute([$orderId !== '' ? 'order:' . $orderId : (string) ($payment['external_payment_id'] ?? ''), $paymentId]);
    $pdo->prepare("UPDATE bookings SET payment_status = 'pending' WHERE id = ? AND payment_status != 'paid' AND status NOT IN ('cancelled', 'completed', 'no_show')")
        ->execute([(string) $payment['booking_id']]);
    return ['ok' => true];
}

function payments_verify_przelewy24_notification(PDO $pdo, array $data): array
{
    global $config;
    if (!payment_gateway_configured()) {
        return ['ok' => false, 'error' => 'Bramka płatnicza nie jest skonfigurowana.'];
    }

    $sessionId = (string) ($data['sessionId'] ?? '');
    $orderId = (int) ($data['orderId'] ?? 0);
    $amount = (int) ($data['amount'] ?? 0);
    $originAmount = (int) ($data['originAmount'] ?? $amount);
    $currency = (string) ($data['currency'] ?? 'PLN');
    $receivedSign = (string) ($data['sign'] ?? '');
    $crc = trim((string) ($config['przelewy24_crc'] ?? ''));
    if ($sessionId === '' || $orderId <= 0 || $amount <= 0 || $receivedSign === '') {
        return ['ok' => false, 'error' => 'Niepełny callback płatności.'];
    }

    $expectedSign = payments_sha384_sign([
        'merchantId' => (int) ($data['merchantId'] ?? 0),
        'posId' => (int) ($data['posId'] ?? 0),
        'sessionId' => $sessionId,
        'amount' => $amount,
        'originAmount' => $originAmount,
        'currency' => $currency,
        'orderId' => $orderId,
        'methodId' => (int) ($data['methodId'] ?? 0),
        'statement' => (string) ($data['statement'] ?? ''),
        'crc' => $crc,
    ]);
    if (!hash_equals($expectedSign, $receivedSign)) {
        return ['ok' => false, 'error' => 'Nieprawidłowy podpis callbacku płatności.'];
    }

    $stmt = $pdo->prepare('SELECT * FROM payments WHERE id = ? AND provider = ? LIMIT 1');
    $stmt->execute([$sessionId, 'przelewy24']);
    $payment = $stmt->fetch();
    if (!$payment) {
        return ['ok' => false, 'error' => 'Nie znaleziono lokalnej płatności.'];
    }

    $localAmount = (int) round(((float) $payment['amount']) * 100);
    if ($localAmount !== $amount || (string) ($payment['currency'] ?? 'PLN') !== $currency) {
        return ['ok' => false, 'error' => 'Kwota płatności nie zgadza się z rezerwacją.'];
    }

    $verifyBody = [
        'merchantId' => (int) ($config['przelewy24_merchant_id'] ?? 0),
        'posId' => (int) ($config['przelewy24_pos_id'] ?? 0),
        'sessionId' => $sessionId,
        'amount' => $amount,
        'currency' => $currency,
        'orderId' => $orderId,
    ];
    $verifyBody['sign'] = payments_sha384_sign([
        'sessionId' => $sessionId,
        'orderId' => $orderId,
        'amount' => $amount,
        'currency' => $currency,
        'crc' => $crc,
    ]);

    $verify = payments_p24_post('/api/v1/transaction/verify', $verifyBody);
    if (empty($verify['ok'])) {
        if ((string) ($payment['status'] ?? '') === 'paid') {
            return ['ok' => true, 'already_paid' => true];
        }
        $pdo->prepare("UPDATE payments SET status = 'pending', external_payment_id = ? WHERE id = ? AND status != 'paid'")
            ->execute(['order:' . $orderId, $sessionId]);
        $pdo->prepare("UPDATE bookings SET payment_status = 'pending' WHERE id = ? AND payment_status != 'paid' AND status NOT IN ('cancelled', 'completed', 'no_show')")
            ->execute([(string) $payment['booking_id']]);
        error_log('Przelewy24 verify failed: ' . json_encode($verify, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return ['ok' => false, 'error' => 'Nie udało się zweryfikować płatności.'];
    }

    $pdo->prepare("UPDATE payments SET status = 'paid', external_payment_id = ?, paid_at = NOW() WHERE id = ?")
        ->execute(['order:' . $orderId, $sessionId]);
    $bookingStmt = $pdo->prepare('SELECT id, status FROM bookings WHERE id = ? LIMIT 1');
    $bookingStmt->execute([(string) $payment['booking_id']]);
    $booking = $bookingStmt->fetch();
    if (!$booking) {
        return ['ok' => false, 'error' => 'Nie znaleziono rezerwacji dla płatności.'];
    }
    if ((string) ($booking['status'] ?? '') === 'cancelled') {
        return ['ok' => true, 'booking_cancelled' => true];
    }
    $pdo->prepare(
        "UPDATE bookings
         SET payment_status = 'paid',
             status = CASE WHEN status = 'pending_payment' THEN 'confirmed' ELSE status END
         WHERE id = ? AND status != 'cancelled'"
    )->execute([(string) $payment['booking_id']]);
    mydr_sync_after_response((string) $payment['booking_id']);

    return ['ok' => true];
}

function payment_handle_route(string $route, string $method): bool
{
    $pdo = db();

    if ($route === '/admin/payments/status' && $method === 'GET') {
        require_admin();
        json_response(payment_gateway_status());
    }

    if ($route === '/payments/status' && $method === 'GET') {
        $token = (string) ($_GET['token'] ?? '');
        $booking = $token !== '' ? payments_fetch_booking_by_token($pdo, $token) : null;
        if (!$booking) {
            json_response(['error' => 'Nie znaleziono rezerwacji.'], 404);
        }
        json_response([
            'payment_status' => (string) ($booking['payment_status'] ?? 'unpaid'),
            'booking_status' => (string) ($booking['status'] ?? 'pending'),
        ]);
    }

    if ($route === '/payments/start' && $method === 'POST') {
        $data = json_input();
        $token = (string) ($data['token'] ?? '');
        $booking = $token !== '' ? payments_fetch_booking_by_token($pdo, $token) : null;
        if (!$booking) {
            json_response(['ok' => false, 'error' => 'Nie znaleziono rezerwacji.'], 404);
        }
        $lockName = 'rez_payment_b_' . substr(hash('sha256', (string) $booking['id']), 0, 32);
        $lock = $pdo->prepare('SELECT GET_LOCK(?, 20)');
        $lock->execute([$lockName]);
        if ((int) $lock->fetchColumn() !== 1) {
            json_response(['ok' => false, 'error' => 'Płatność jest już uruchamiana. Spróbuj ponownie za chwilę.'], 409);
        }
        try {
            $booking = payments_fetch_booking_by_token($pdo, $token);
            if (!$booking) {
                $result = ['ok' => false, 'error' => 'Nie znaleziono rezerwacji.', 'http_status' => 404];
            } else {
                $result = payment_gateway_provider() === 'payu'
                    ? payments_register_payu($pdo, $booking)
                    : payments_register_przelewy24($pdo, $booking);
            }
        } finally {
            $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
        }
        json_response($result, !empty($result['ok']) ? 200 : (int) ($result['http_status'] ?? 400));
    }

    if ($route === '/payments/payu/notify') {
        if ($method !== 'POST') {
            json_response(['error' => 'Method not allowed'], 405);
        }
        $raw = file_get_contents('php://input') ?: '';
        $data = json_decode($raw, true);
        $result = payments_handle_payu_notification($pdo, $raw, is_array($data) ? $data : []);
        if (empty($result['ok'])) {
            error_log('PayU callback rejected: ' . (string) ($result['error'] ?? 'unknown'));
            json_response(['error' => 'Payment verification failed'], 400);
        }
        header('Content-Type: text/plain; charset=utf-8');
        echo 'OK';
        exit;
    }

    if ($route === '/payments/przelewy24/status') {
        if ($method !== 'POST') {
            json_response(['error' => 'Method not allowed'], 405);
        }
        $result = payments_verify_przelewy24_notification($pdo, json_input());
        if (empty($result['ok'])) {
            error_log('Przelewy24 callback rejected: ' . (string) ($result['error'] ?? 'unknown'));
            json_response(['error' => 'Payment verification failed'], 400);
        }
        header('Content-Type: text/plain; charset=utf-8');
        echo 'OK';
        exit;
    }

    return false;
}
