<?php
declare(strict_types=1);

function psychiatric_form_recipient(): string
{
    global $config;
    foreach (['psychiatric_form_email', 'contact_form_email', 'owner_notification_email', 'mail_reply_to'] as $key) {
        $value = trim((string) ($config[$key] ?? ''));
        if (filter_var($value, FILTER_VALIDATE_EMAIL)) return $value;
    }
    return '';
}

function psychiatric_form_encrypt(string $plaintext): array
{
    global $config;
    $material = (string) ($config['visit_report_signing_key'] ?? '') . '|' . (string) ($config['admin_password'] ?? '');
    $key = hash('sha256', $material, true);
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if ($ciphertext === false || strlen($tag) !== 16) throw new RuntimeException('Encryption failed');
    return [$ciphertext, $iv, $tag];
}

function psychiatric_form_send_mail(string $patientName, array $fields, string $createdAt): bool
{
    global $config;
    $recipient = psychiatric_form_recipient();
    if ($recipient === '') return false;
    $escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $rows = '';
    foreach ($fields as $name => $value) {
        if (is_bool($value)) {
            if (!$value) continue;
            $value = 'Tak';
        }
        if (!is_scalar($value)) continue;
        $value = trim((string) $value);
        if ($value === '') continue;
        $label = ucfirst(str_replace('_', ' ', (string) $name));
        $rows .= '<tr><th style="padding:8px;border:1px solid #d6d3d1;text-align:left;vertical-align:top;background:#f5f5f4">'
            . $escape($label) . '</th><td style="padding:8px;border:1px solid #d6d3d1;white-space:pre-wrap">'
            . nl2br($escape($value)) . '</td></tr>';
    }
    $body = '<html><body style="font-family:Arial,sans-serif;color:#1c1917"><h2>Karta wywiadu ogólnopsychiatrycznego</h2>'
        . '<p><strong>Pacjent:</strong> ' . $escape($patientName) . '<br><strong>Wysłano:</strong> ' . $escape($createdAt) . '</p>'
        . '<table style="border-collapse:collapse;width:100%;max-width:1000px">' . $rows . '</table></body></html>';
    $from = trim((string) ($config['mail_from'] ?? 'noreply@localhost'));
    $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: Formularz <{$from}>\r\n";
    $safeName = trim(preg_replace('/[\r\n]+/', ' ', $patientName) ?? '');
    $subject = 'Wywiad ogólnopsychiatryczny - ' . ($safeName !== '' ? $safeName : 'bez nazwiska');
    return @mail($recipient, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
}

function psychiatric_form_handle(string $method): void
{
    if ($method !== 'POST') json_response(['error' => 'Method not allowed'], 405);
    $rate = rate_limit_consume('psychiatric-form', 12, 3600);
    if (!$rate['allowed']) json_response(['error' => 'Spróbuj ponownie później.'], 429);
    $data = json_input();
    if (trim((string) ($data['website'] ?? '')) !== '') json_response(['ok' => true], 201);
    $fields = $data['fields'] ?? null;
    $consent = ($data['consent'] ?? false) === true;
    $patientName = trim((string) ($data['patient_name'] ?? ''));
    if (!is_array($fields) || mb_strlen($patientName, 'UTF-8') > 255) {
        json_response(['error' => 'Nieprawidłowa zawartość formularza.'], 422);
    }
    if (count($fields) > 800) json_response(['error' => 'Formularz zawiera zbyt wiele pól.'], 422);
    $json = json_encode($fields, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || strlen($json) > 1000000) json_response(['error' => 'Formularz jest zbyt duży.'], 422);
    [$ciphertext, $iv, $tag] = psychiatric_form_encrypt($json);
    $id = bin2hex(random_bytes(16));
    $createdAt = date('Y-m-d H:i:s');
    $stmt = db()->prepare('INSERT INTO psychiatric_interview_submissions (id, patient_name, form_ciphertext, form_iv, form_tag, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $storedName = $patientName !== '' ? $patientName : 'Bez nazwiska';
    $stmt->execute([$id, $storedName, $ciphertext, $iv, $tag, $consent ? $createdAt : null, $createdAt]);
    $mailSent = psychiatric_form_send_mail($storedName, $fields, $createdAt);
    json_response(['ok' => true, 'mail_sent' => $mailSent], 201);
}
