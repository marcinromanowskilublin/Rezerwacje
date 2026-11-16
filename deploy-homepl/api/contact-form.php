<?php
declare(strict_types=1);

function contact_form_text(string $value, int $max): string
{
    $value = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '');
    return mb_substr($value, 0, $max, 'UTF-8');
}

function contact_form_mail(array $submission): bool
{
    global $config;
    $recipient = trim((string) ($config['contact_form_email'] ?? ''));
    if ($recipient === '') $recipient = trim((string) ($config['owner_notification_email'] ?? ''));
    if ($recipient === '') $recipient = trim((string) ($config['mail_reply_to'] ?? ''));
    if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) return false;

    $from = trim((string) ($config['mail_from'] ?? 'noreply@localhost'));
    $replyTo = (string) $submission['email'];
    $escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $rows = [
        'Imię i nazwisko' => (string) $submission['name'],
        'E-mail' => (string) $submission['email'],
        'Telefon' => (string) $submission['phone'],
        'Wiadomość' => (string) $submission['message'],
        'Wysłano' => (string) $submission['created_at'],
    ];
    $table = '';
    foreach ($rows as $label => $value) {
        $table .= '<tr><th style="padding:10px;border:1px solid #d6d3d1;text-align:left;vertical-align:top;background:#f5f5f4">'
            . $escape($label) . '</th><td style="padding:10px;border:1px solid #d6d3d1;white-space:pre-wrap">'
            . nl2br($escape($value)) . '</td></tr>';
    }
    $copyBlock = implode("\t", [
        (string) $submission['name'], (string) $submission['email'], (string) $submission['phone'],
        preg_replace('/\s+/u', ' ', (string) $submission['message']) ?? '',
    ]);
    $body = '<html><body style="font-family:Arial,sans-serif;color:#1c1917">'
        . '<h2>Nowe zgłoszenie z formularza</h2><table style="border-collapse:collapse;width:100%;max-width:800px">'
        . $table . '</table><p style="margin-top:20px"><strong>Wiersz gotowy do skopiowania:</strong></p>'
        . '<pre style="padding:12px;background:#f5f5f4;border:1px solid #d6d3d1;white-space:pre-wrap">'
        . $escape($copyBlock) . '</pre></body></html>';

    $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n";
    $headers .= 'From: Formularz <' . $from . ">\r\n";
    if (filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $headers .= 'Reply-To: ' . $replyTo . "\r\n";
    return @mail($recipient, '=?UTF-8?B?' . base64_encode('Nowe zgłoszenie z formularza') . '?=', $body, $headers);
}

function contact_form_handle(string $method): void
{
    if ($method !== 'POST') json_response(['error' => 'Method not allowed'], 405);
    $rate = rate_limit_consume('contact-form', 5, 3600);
    if (!$rate['allowed']) json_response(['error' => 'Spróbuj ponownie później.'], 429);

    $data = json_input();
    if (trim((string) ($data['website'] ?? '')) !== '') json_response(['ok' => true], 201);
    $name = contact_form_text((string) ($data['name'] ?? ''), 160);
    $email = contact_form_text((string) ($data['email'] ?? ''), 255);
    $phone = contact_form_text((string) ($data['phone'] ?? ''), 40);
    $message = contact_form_text((string) ($data['message'] ?? ''), 5000);
    $consent = ($data['consent'] ?? false) === true;
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $phone === '' || $message === '' || !$consent) {
        json_response(['error' => 'Uzupełnij wymagane pola.'], 422);
    }

    $id = bin2hex(random_bytes(16));
    $createdAt = date('Y-m-d H:i:s');
    $pdo = db();
    $stmt = $pdo->prepare('INSERT INTO contact_form_submissions (id, name, email, phone, message, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$id, $name, $email, $phone, $message, $createdAt, $createdAt]);
    $mailSent = contact_form_mail(compact('name', 'email', 'phone', 'message') + ['created_at' => $createdAt]);
    json_response(['ok' => true, 'mail_sent' => $mailSent], 201);
}
