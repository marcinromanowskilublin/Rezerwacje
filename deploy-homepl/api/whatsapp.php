<?php
declare(strict_types=1);

function whatsapp_digits(string $phone): string
{
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if (str_starts_with($digits, '00')) {
        $digits = substr($digits, 2);
    }
    if (strlen($digits) === 9) {
        $digits = '48' . $digits;
    }
    return $digits;
}

function whatsapp_configured(): bool
{
    global $config;
    $token = trim((string) ($config['whatsapp_token'] ?? ''));
    $phoneId = trim((string) ($config['whatsapp_phone_number_id'] ?? ''));
    return $token !== '' && $phoneId !== '';
}

function send_whatsapp_text(string $to, string $body): bool
{
    global $config;

    $token = trim((string) ($config['whatsapp_token'] ?? ''));
    $phoneId = trim((string) ($config['whatsapp_phone_number_id'] ?? ''));
    $to = whatsapp_digits($to);
    $body = trim($body);
    if ($token === '' || $phoneId === '' || $to === '' || $body === '') {
        return false;
    }

    $url = 'https://graph.facebook.com/v21.0/' . rawurlencode($phoneId) . '/messages';
    $payload = [
        'messaging_product' => 'whatsapp',
        'recipient_type' => 'individual',
        'to' => $to,
        'type' => 'text',
        'text' => [
            'preview_url' => false,
            'body' => $body,
        ],
    ];

    $ch = curl_init($url);
    if ($ch === false) {
        return false;
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!is_string($raw) || $code < 200 || $code >= 300) {
        return false;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) && isset($decoded['messages'][0]['id']);
}

function send_owner_booking_whatsapp(array $booking): bool
{
    global $config;

    $to = trim((string) ($config['whatsapp_owner_number'] ?? ''));
    if ($to === '') {
        return false;
    }

    $info = owner_booking_summary($booking);
    $adminUrl = public_app_url('admin');
    $first = owner_contact_or_dash($info['first_name']);
    $last = owner_contact_or_dash($info['last_name']);
    $phone = owner_contact_or_dash($info['phone']);
    $email = owner_contact_or_dash($info['email']);
    $body = "Nowa rezerwacja: {$info['name']}\nImię: {$first}\nNazwisko: {$last}\nTelefon: {$phone}\nE-mail: {$email}\n{$info['date']} {$info['time']} · {$info['kind']}\n{$adminUrl}";

    return send_whatsapp_text($to, $body);
}

function send_owner_cancel_whatsapp(array $booking): bool
{
    global $config;

    $to = trim((string) ($config['whatsapp_owner_number'] ?? ''));
    if ($to === '') {
        return false;
    }

    $info = owner_booking_summary($booking);
    $adminUrl = public_app_url('admin');
    $first = owner_contact_or_dash($info['first_name']);
    $last = owner_contact_or_dash($info['last_name']);
    $phone = owner_contact_or_dash($info['phone']);
    $email = owner_contact_or_dash($info['email']);
    $body = "Wypis: {$info['name']}\nImię: {$first}\nNazwisko: {$last}\nTelefon: {$phone}\nE-mail: {$email}\n{$info['date']} {$info['time']} · {$info['kind']}\n{$adminUrl}";

    return send_whatsapp_text($to, $body);
}
