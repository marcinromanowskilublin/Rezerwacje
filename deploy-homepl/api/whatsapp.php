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

function whatsapp_graph_url(string $path): string
{
    global $config;
    $version = trim((string) ($config['whatsapp_graph_version'] ?? 'v21.0'));
    if (!preg_match('/^v\d+\.\d+$/', $version)) {
        $version = 'v21.0';
    }
    return 'https://graph.facebook.com/' . $version . '/' . ltrim($path, '/');
}

function whatsapp_send_text_result(string $to, string $body): array
{
    global $config;
    $token = trim((string) ($config['whatsapp_token'] ?? ''));
    $phoneId = trim((string) ($config['whatsapp_phone_number_id'] ?? ''));
    $to = whatsapp_digits($to);
    $body = trim($body);
    if ($token === '' || $phoneId === '' || $to === '' || $body === '') {
        return ['ok' => false, 'id' => null, 'error' => 'WhatsApp nie jest skonfigurowany.'];
    }

    $url = whatsapp_graph_url(rawurlencode($phoneId) . '/messages');
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
        return ['ok' => false, 'id' => null, 'error' => 'Nie udało się uruchomić połączenia z Meta.'];
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
        return ['ok' => false, 'id' => null, 'error' => 'Meta odrzuciła wiadomość.'];
    }
    $decoded = json_decode($raw, true);
    $id = is_array($decoded) ? (string) ($decoded['messages'][0]['id'] ?? '') : '';
    return [
        'ok' => $id !== '',
        'id' => $id !== '' ? $id : null,
        'error' => $id !== '' ? null : 'Meta nie zwróciła identyfikatora wiadomości.',
    ];
}

function send_whatsapp_text(string $to, string $body): bool
{
    return (bool) (whatsapp_send_text_result($to, $body)['ok'] ?? false);
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

function whatsapp_retention_days(): int
{
    global $config;
    return max(1, min(180, (int) ($config['whatsapp_retention_days'] ?? 30)));
}

function whatsapp_messages_configured(): bool
{
    global $config;
    return whatsapp_configured()
        && trim((string) ($config['whatsapp_business_number'] ?? '')) !== ''
        && trim((string) ($config['whatsapp_app_secret'] ?? '')) !== ''
        && trim((string) ($config['whatsapp_webhook_verify_token'] ?? '')) !== ''
        && strlen(trim((string) ($config['whatsapp_encryption_key'] ?? ''))) >= 32;
}

function whatsapp_bot_enabled(): bool
{
    global $config;
    return whatsapp_messages_configured() && !empty($config['whatsapp_bot_enabled']);
}

function whatsapp_bot_delay_minutes(): int
{
    global $config;
    return max(5, min(1440, (int) ($config['whatsapp_bot_delay_minutes'] ?? 120)));
}

function whatsapp_bot_first_reply(): string
{
    global $config;
    $text = trim((string) ($config['whatsapp_bot_first_reply'] ?? ''));
    if ($text !== '') {
        return $text;
    }
    return "Dzień dobry, odczytałem wiadomość. Zbiorę potrzebne informacje i przekażę sprawę do odpowiedzi.";
}

function whatsapp_bot_menu_text(): string
{
    global $config;
    $text = trim((string) ($config['whatsapp_bot_menu_text'] ?? ''));
    if ($text !== '') {
        return $text;
    }
    return "Wybierz numer sprawy:\n1. Odwołanie wizyty\n2. Przełożenie terminu\n3. Recepta/leki\n4. Dokumenty/zaświadczenie\n5. Płatność\n6. Inna sprawa";
}

function whatsapp_crypto_key(): string
{
    global $config;
    $secret = trim((string) ($config['whatsapp_encryption_key'] ?? ''));
    if (strlen($secret) < 32) {
        throw new RuntimeException('Brak bezpiecznego klucza szyfrowania WhatsApp.');
    }
    return hash('sha256', $secret, true);
}

function whatsapp_lookup_hash(string $namespace, string $value): string
{
    return hash_hmac('sha256', $namespace . ':' . $value, whatsapp_crypto_key());
}

function whatsapp_encrypt_body(string $plain): array
{
    if ($plain === '') {
        return [null, null, null];
    }
    if (!function_exists('openssl_encrypt')) {
        throw new RuntimeException('Serwer nie obsługuje szyfrowania OpenSSL.');
    }
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt(
        $plain,
        'aes-256-gcm',
        whatsapp_crypto_key(),
        OPENSSL_RAW_DATA,
        $iv,
        $tag
    );
    if (!is_string($ciphertext) || strlen($tag) !== 16) {
        throw new RuntimeException('Nie udało się zaszyfrować wiadomości.');
    }
    return [$ciphertext, $iv, $tag];
}

function whatsapp_decrypt_body($ciphertext, $iv, $tag): string
{
    if (!is_string($ciphertext) || $ciphertext === '') {
        return '';
    }
    if (!is_string($iv) || strlen($iv) !== 12 || !is_string($tag) || strlen($tag) !== 16) {
        return '';
    }
    $plain = openssl_decrypt(
        $ciphertext,
        'aes-256-gcm',
        whatsapp_crypto_key(),
        OPENSSL_RAW_DATA,
        $iv,
        $tag
    );
    return is_string($plain) ? $plain : '';
}

function whatsapp_encrypt_json(array $data): array
{
    return whatsapp_encrypt_body(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}');
}

function whatsapp_decrypt_json($ciphertext, $iv, $tag): array
{
    $plain = whatsapp_decrypt_body($ciphertext, $iv, $tag);
    if ($plain === '') {
        return [];
    }
    $decoded = json_decode($plain, true);
    return is_array($decoded) ? $decoded : [];
}

function whatsapp_message_datetime($timestamp): ?string
{
    if (is_numeric($timestamp)) {
        $value = (int) $timestamp;
        if ($value > 20000000000) {
            $value = intdiv($value, 1000);
        }
        if ($value > 0) {
            return gmdate('Y-m-d H:i:s', $value);
        }
    }
    if (is_string($timestamp) && trim($timestamp) !== '') {
        $parsed = strtotime($timestamp);
        if ($parsed !== false) {
            return gmdate('Y-m-d H:i:s', $parsed);
        }
    }
    return null;
}

function whatsapp_extract_message_body(array $message): string
{
    $type = (string) ($message['type'] ?? 'text');
    if ($type === 'text') {
        return trim((string) ($message['text']['body'] ?? ''));
    }
    if ($type === 'button') {
        return trim((string) ($message['button']['text'] ?? ''));
    }
    if ($type === 'interactive') {
        return trim((string) (
            $message['interactive']['button_reply']['title']
            ?? $message['interactive']['list_reply']['title']
            ?? ''
        ));
    }
    $labels = [
        'audio' => 'Wiadomość głosowa',
        'document' => 'Dokument',
        'image' => 'Zdjęcie',
        'location' => 'Lokalizacja',
        'sticker' => 'Naklejka',
        'video' => 'Wideo',
        'contacts' => 'Kontakt',
        'reaction' => 'Reakcja',
    ];
    return '[' . ($labels[$type] ?? 'Wiadomość') . ']';
}

function whatsapp_issue_category(string $body): string
{
    $text = function_exists('mb_strtolower')
        ? mb_strtolower($body, 'UTF-8')
        : strtolower($body);
    $groups = [
        'termin' => ['termin', 'wizy', 'przeło', 'odwoła', 'godzin', 'zapisa'],
        'recepta' => ['recept', 'lek się kończy', 'leki się kończą', 'wypisa'],
        'dokumenty' => ['zaświadc', 'dokument', 'ol-9', 'opini', 'zwoln', 'l4'],
        'płatność' => ['płat', 'przelew', 'blik', 'faktur', 'rachun'],
        'leczenie' => ['działani', 'objaw', 'dawka', 'lek', 'samopocz'],
    ];
    foreach ($groups as $category => $needles) {
        foreach ($needles as $needle) {
            if (str_contains($text, $needle)) {
                return $category;
            }
        }
    }
    return 'inna';
}

function whatsapp_collect_contacts($node, array &$contacts): void
{
    if (!is_array($node)) {
        return;
    }
    if (isset($node['contacts']) && is_array($node['contacts'])) {
        foreach ($node['contacts'] as $contact) {
            if (!is_array($contact)) {
                continue;
            }
            $waId = whatsapp_digits((string) ($contact['wa_id'] ?? $contact['input'] ?? ''));
            $name = trim((string) ($contact['profile']['name'] ?? $contact['name'] ?? ''));
            if ($waId !== '' && $name !== '') {
                $contacts[$waId] = $name;
            }
        }
    }
    foreach ($node as $value) {
        if (is_array($value)) {
            whatsapp_collect_contacts($value, $contacts);
        }
    }
}

function whatsapp_collect_messages($node, array &$messages, bool $history = false): void
{
    if (!is_array($node)) {
        return;
    }
    if (isset($node['messages']) && is_array($node['messages'])) {
        foreach ($node['messages'] as $message) {
            if (is_array($message) && !empty($message['id'])) {
                $messages[] = ['message' => $message, 'history' => $history];
            }
        }
    }
    foreach ($node as $key => $value) {
        if (!is_array($value) || $key === 'messages') {
            continue;
        }
        whatsapp_collect_messages($value, $messages, $history || $key === 'history');
    }
}

function whatsapp_collect_statuses($node, array &$statuses): void
{
    if (!is_array($node)) {
        return;
    }
    if (isset($node['statuses']) && is_array($node['statuses'])) {
        foreach ($node['statuses'] as $status) {
            if (is_array($status) && !empty($status['id'])) {
                $statuses[] = $status;
            }
        }
    }
    foreach ($node as $key => $value) {
        if (is_array($value) && $key !== 'statuses') {
            whatsapp_collect_statuses($value, $statuses);
        }
    }
}

function whatsapp_collect_configured_phone_payload(array $payload, array &$contacts, array &$messages, array &$statuses): void
{
    global $config;
    $expectedPhoneId = trim((string) ($config['whatsapp_phone_number_id'] ?? ''));
    if ($expectedPhoneId === '') {
        whatsapp_collect_contacts($payload, $contacts);
        whatsapp_collect_messages($payload, $messages);
        whatsapp_collect_statuses($payload, $statuses);
        return;
    }

    foreach ((array) ($payload['entry'] ?? []) as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        foreach ((array) ($entry['changes'] ?? []) as $change) {
            if (!is_array($change)) {
                continue;
            }
            $value = $change['value'] ?? null;
            if (!is_array($value)) {
                continue;
            }
            $phoneId = trim((string) ($value['metadata']['phone_number_id'] ?? ''));
            if ($phoneId === '' || !hash_equals($expectedPhoneId, $phoneId)) {
                continue;
            }
            whatsapp_collect_contacts($value, $contacts);
            whatsapp_collect_messages($value, $messages);
            whatsapp_collect_statuses($value, $statuses);
        }
    }
}

function whatsapp_find_patient(PDO $pdo, string $waId): array
{
    $canonical = whatsapp_digits($waId);
    if ($canonical === '') {
        return ['booking_id' => null, 'patient_name' => null];
    }
    $variants = [$canonical];
    if (str_starts_with($canonical, '48') && strlen($canonical) === 11) {
        $variants[] = substr($canonical, -9);
    }
    $variants = array_values(array_unique($variants));
    $normalized = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(patient_phone, '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')";
    $placeholders = implode(',', array_fill(0, count($variants), '?'));
    $stmt = $pdo->prepare(
        "SELECT id, patient_name, patient_phone
         FROM bookings
         WHERE {$normalized} IN ({$placeholders})
         ORDER BY booking_date DESC, start_time DESC, created_at DESC
         LIMIT 10"
    );
    $stmt->execute($variants);
    foreach ($stmt as $row) {
        if (whatsapp_digits((string) ($row['patient_phone'] ?? '')) === $canonical) {
            return [
                'booking_id' => (string) $row['id'],
                'patient_name' => trim((string) $row['patient_name']),
            ];
        }
    }
    return ['booking_id' => null, 'patient_name' => null];
}

function whatsapp_upsert_booking_thread(PDO $pdo, array $booking): void
{
    if (!whatsapp_messages_configured()) {
        return;
    }
    $waId = whatsapp_digits((string) ($booking['patient_phone'] ?? ''));
    $patientName = trim((string) ($booking['patient_name'] ?? ''));
    $bookingId = trim((string) ($booking['id'] ?? ''));
    if ($waId === '' || $patientName === '' || $bookingId === '') {
        return;
    }

    $lastAt = trim((string) ($booking['created_at'] ?? ''));
    if ($lastAt === '') {
        $lastAt = gmdate('Y-m-d H:i:s');
    }
    $waHash = whatsapp_lookup_hash('wa-id', $waId);
    [$waCiphertext, $waIv, $waTag] = whatsapp_encrypt_body($waId);
    [$patientCiphertext, $patientIv, $patientTag] = whatsapp_encrypt_body($patientName);
    [$bookingCiphertext, $bookingIv, $bookingTag] = whatsapp_encrypt_body($bookingId);
    [$categoryCiphertext, $categoryIv, $categoryTag] = whatsapp_encrypt_body('termin');

    $stmt = $pdo->prepare(
        "INSERT INTO whatsapp_threads
            (wa_id_hash, wa_id_ciphertext, wa_id_iv, wa_id_tag,
             profile_name_ciphertext, profile_name_iv, profile_name_tag,
             patient_name_ciphertext, patient_name_iv, patient_name_tag,
             booking_id_ciphertext, booking_id_iv, booking_id_tag, is_patient,
             issue_category_ciphertext, issue_category_iv, issue_category_tag, last_message_at)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            wa_id_ciphertext = VALUES(wa_id_ciphertext),
            wa_id_iv = VALUES(wa_id_iv),
            wa_id_tag = VALUES(wa_id_tag),
            patient_name_ciphertext = VALUES(patient_name_ciphertext),
            patient_name_iv = VALUES(patient_name_iv),
            patient_name_tag = VALUES(patient_name_tag),
            booking_id_ciphertext = VALUES(booking_id_ciphertext),
            booking_id_iv = VALUES(booking_id_iv),
            booking_id_tag = VALUES(booking_id_tag),
            issue_category_ciphertext = VALUES(issue_category_ciphertext),
            issue_category_iv = VALUES(issue_category_iv),
            issue_category_tag = VALUES(issue_category_tag),
            is_patient = 1,
            last_message_at = GREATEST(last_message_at, VALUES(last_message_at))"
    );
    $stmt->execute([
        $waHash,
        $waCiphertext,
        $waIv,
        $waTag,
        $patientCiphertext,
        $patientIv,
        $patientTag,
        $bookingCiphertext,
        $bookingIv,
        $bookingTag,
        $categoryCiphertext,
        $categoryIv,
        $categoryTag,
        $lastAt,
    ]);
}

function whatsapp_bot_thread_data(array $row): array
{
    return whatsapp_decrypt_json(
        $row['bot_data_ciphertext'] ?? null,
        $row['bot_data_iv'] ?? null,
        $row['bot_data_tag'] ?? null
    );
}

function whatsapp_bot_save_data(PDO $pdo, int $threadId, array $data): void
{
    [$ciphertext, $iv, $tag] = whatsapp_encrypt_json($data);
    $stmt = $pdo->prepare(
        'UPDATE whatsapp_threads
         SET bot_data_ciphertext = ?, bot_data_iv = ?, bot_data_tag = ?
         WHERE id = ?'
    );
    $stmt->execute([$ciphertext, $iv, $tag, $threadId]);
}

function whatsapp_bot_save_summary(PDO $pdo, int $threadId, string $summary): void
{
    [$ciphertext, $iv, $tag] = whatsapp_encrypt_body($summary);
    $stmt = $pdo->prepare(
        'UPDATE whatsapp_threads
         SET triage_summary_ciphertext = ?, triage_summary_iv = ?, triage_summary_tag = ?
         WHERE id = ?'
    );
    $stmt->execute([$ciphertext, $iv, $tag, $threadId]);
}

function whatsapp_bot_category_from_text(string $body): array
{
    $text = function_exists('mb_strtolower') ? mb_strtolower(trim($body), 'UTF-8') : strtolower(trim($body));
    $digits = preg_replace('/\D+/', '', $text) ?? '';
    if ($digits !== '') {
        $choice = $digits[0];
        if ($choice === '1') return ['odwołanie', 'Odwołanie wizyty', 'termin', 'high'];
        if ($choice === '2') return ['przełożenie', 'Przełożenie terminu', 'termin', 'high'];
        if ($choice === '3') return ['recepta', 'Recepta/leki', 'recepta', 'high'];
        if ($choice === '4') return ['dokumenty', 'Dokumenty/zaświadczenie', 'dokumenty', 'normal'];
        if ($choice === '5') return ['płatność', 'Płatność', 'płatność', 'normal'];
        if ($choice === '6') return ['inna', 'Inna sprawa', 'inna', 'normal'];
    }
    if (str_contains($text, 'odwo')) return ['odwołanie', 'Odwołanie wizyty', 'termin', 'high'];
    if (str_contains($text, 'przeł') || str_contains($text, 'przel') || str_contains($text, 'termin')) return ['przełożenie', 'Przełożenie terminu', 'termin', 'high'];
    if (str_contains($text, 'recept') || str_contains($text, 'lek')) return ['recepta', 'Recepta/leki', 'recepta', 'high'];
    if (str_contains($text, 'dokument') || str_contains($text, 'zaświadc')) return ['dokumenty', 'Dokumenty/zaświadczenie', 'dokumenty', 'normal'];
    if (str_contains($text, 'płat') || str_contains($text, 'faktur') || str_contains($text, 'blik')) return ['płatność', 'Płatność', 'płatność', 'normal'];
    return ['inna', 'Inna sprawa', 'inna', 'normal'];
}

function whatsapp_bot_detect_category_from_context(string $body): ?array
{
    [$category, $label, $issueCategory, $priority] = whatsapp_bot_category_from_text($body);
    return $category === 'inna' ? null : [$category, $label, $issueCategory, $priority];
}

function whatsapp_bot_labels_from_text(string $body): array
{
    $text = function_exists('mb_strtolower') ? mb_strtolower(trim($body), 'UTF-8') : strtolower(trim($body));
    $labels = [];
    $add = static function (string $label) use (&$labels): void {
        if (!in_array($label, $labels, true)) {
            $labels[] = $label;
        }
    };
    if (str_contains($text, 'odwo')) $add('odwołanie');
    if (str_contains($text, 'przeł') || str_contains($text, 'przel') || str_contains($text, 'zmian') || str_contains($text, 'termin')) $add('termin');
    if (str_contains($text, 'recept') || str_contains($text, 'lek')) $add('recepta/leki');
    if (str_contains($text, 'dokument') || str_contains($text, 'zaświadc') || str_contains($text, 'l4') || str_contains($text, 'zwoln')) $add('dokumenty');
    if (str_contains($text, 'płat') || str_contains($text, 'faktur') || str_contains($text, 'blik') || str_contains($text, 'przelew')) $add('płatność');
    if (str_contains($text, 'piln') || str_contains($text, 'szybko') || str_contains($text, 'dzisiaj')) $add('pilne');
    if (preg_match('/\b\d{11}\b/', $text)) $add('PESEL');
    return $labels;
}

function whatsapp_bot_merge_labels(array ...$sets): array
{
    $labels = [];
    foreach ($sets as $set) {
        foreach ($set as $label) {
            $label = trim((string) $label);
            if ($label !== '' && !in_array($label, $labels, true)) {
                $labels[] = $label;
            }
        }
    }
    return array_slice($labels, 0, 8);
}

function whatsapp_bot_last_inbound_body(PDO $pdo, int $threadId): string
{
    $stmt = $pdo->prepare(
        "SELECT body_ciphertext, body_iv, body_tag
         FROM whatsapp_messages
         WHERE thread_id = ? AND direction = 'inbound'
         ORDER BY sent_at DESC, id DESC
         LIMIT 1"
    );
    $stmt->execute([$threadId]);
    $row = $stmt->fetch();
    return $row ? whatsapp_decrypt_body($row['body_ciphertext'], $row['body_iv'], $row['body_tag']) : '';
}

function whatsapp_bot_extract_identity(string $body): array
{
    $pesel = '';
    if (preg_match('/\b\d{11}\b/', $body, $match)) {
        $pesel = $match[0];
    }
    $lines = array_values(array_filter(array_map(
        static fn($line): string => trim((string) $line),
        preg_split('/\R+/', trim($body)) ?: []
    )));
    $name = $lines[0] ?? '';
    $address = '';
    foreach ($lines as $line) {
        $lower = function_exists('mb_strtolower') ? mb_strtolower($line, 'UTF-8') : strtolower($line);
        if (str_contains($lower, 'ul.') || str_contains($lower, 'ulica') || preg_match('/\d{2}-\d{3}/', $line)) {
            $address = $line;
            break;
        }
    }
    if ($address === '' && count($lines) >= 3) {
        $address = implode(', ', array_slice($lines, 2));
    }
    return [
        'identity_raw' => trim($body),
        'name' => $name,
        'pesel' => $pesel,
        'address' => $address,
    ];
}

function whatsapp_bot_prompt_identity(): string
{
    return "Dziękuję. Podaj proszę w jednej wiadomości:\n- imię i nazwisko\n- PESEL\n- adres\n\nNastępnie dopytam o szczegóły sprawy.";
}

function whatsapp_bot_prompt_details(): string
{
    return "Dziękuję. Opisz proszę krótko sprawę: czego potrzebujesz i czy dotyczy konkretnego terminu wizyty.";
}

function whatsapp_bot_done_text(): string
{
    return "Dziękuję, zebrałem informacje i przekażę je do odpowiedzi. Jeśli sprawa jest pilna lub dotyczy zagrożenia zdrowia/życia, zadzwoń pod 112 albo zgłoś się do najbliższej pomocy doraźnej.";
}

function whatsapp_bot_summary(array $data): string
{
    $label = trim((string) ($data['category_label'] ?? 'Sprawa WhatsApp'));
    $name = trim((string) ($data['name'] ?? ''));
    $details = trim((string) ($data['details'] ?? ''));
    $parts = [$label];
    if ($name !== '') {
        $parts[] = $name;
    }
    if ($details !== '') {
        $parts[] = function_exists('mb_substr') ? mb_substr($details, 0, 180, 'UTF-8') : substr($details, 0, 180);
    }
    return implode(' · ', $parts);
}

function whatsapp_bot_upsert_intent(PDO $pdo, int $threadId, array $thread, array $data): void
{
    if (function_exists('contact_center_ensure_tables')) {
        contact_center_ensure_tables($pdo);
    }
    $sourceId = 'whatsapp_thread:' . $threadId;
    $title = trim((string) ($data['category_label'] ?? 'Sprawa WhatsApp'));
    $summary = 'Dane zebrał bot WhatsApp. Szczegóły są w szyfrowanym wątku WhatsApp.';
    $category = trim((string) ($data['issue_category'] ?? 'inna')) ?: 'inna';
    $priority = trim((string) ($data['priority'] ?? 'normal')) ?: 'normal';
    $contact = trim((string) ($data['name'] ?? ''));
    if ($contact === '') {
        $contact = whatsapp_decrypt_body(
            $thread['profile_name_ciphertext'] ?? null,
            $thread['profile_name_iv'] ?? null,
            $thread['profile_name_tag'] ?? null
        );
    }
    if ($contact === '') {
        $contact = 'WhatsApp +' . whatsapp_decrypt_body(
            $thread['wa_id_ciphertext'] ?? null,
            $thread['wa_id_iv'] ?? null,
            $thread['wa_id_tag'] ?? null
        );
    }
    $phone = '+' . whatsapp_digits(whatsapp_decrypt_body(
        $thread['wa_id_ciphertext'] ?? null,
        $thread['wa_id_iv'] ?? null,
        $thread['wa_id_tag'] ?? null
    ));

    $existing = $pdo->prepare(
        "SELECT id FROM contact_intents WHERE channel = 'whatsapp' AND source_id = ? AND status = 'pending' LIMIT 1"
    );
    $existing->execute([$sourceId]);
    $id = (string) ($existing->fetchColumn() ?: '');
    if ($id !== '') {
        $stmt = $pdo->prepare(
            'UPDATE contact_intents
             SET contact_label = ?, phone = ?, title = ?, summary = ?, category = ?, priority = ?, updated_at = UTC_TIMESTAMP()
             WHERE id = ?'
        );
        $stmt->execute([$contact, $phone, $title, $summary, $category, $priority, $id]);
        return;
    }

    $id = 'intent_' . bin2hex(random_bytes(8));
    $stmt = $pdo->prepare(
        'INSERT INTO contact_intents
            (id, channel, source_id, contact_label, phone, title, summary, category, priority, status, extracted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())'
    );
    $stmt->execute([$id, 'whatsapp', $sourceId, $contact, $phone, $title, $summary, $category, $priority, 'pending']);
}

function whatsapp_bot_send_text(PDO $pdo, int $threadId, string $waId, string $body): bool
{
    global $config;
    $result = whatsapp_send_text_result($waId, $body);
    if (empty($result['ok']) || empty($result['id'])) {
        return false;
    }
    whatsapp_store_message($pdo, [
        'id' => (string) $result['id'],
        'timestamp' => time(),
        'from' => whatsapp_digits((string) ($config['whatsapp_business_number'] ?? '')),
        'to' => $waId,
        'type' => 'text',
        'text' => ['body' => $body],
    ], [], false);
    $stmt = $pdo->prepare('UPDATE whatsapp_threads SET bot_last_auto_reply_at = UTC_TIMESTAMP() WHERE id = ?');
    $stmt->execute([$threadId]);
    return true;
}

function whatsapp_bot_arm_after_inbound(PDO $pdo, int $threadId): void
{
    if (!whatsapp_bot_enabled()) {
        return;
    }
    $stmt = $pdo->prepare(
        "UPDATE whatsapp_threads
         SET bot_next_action_at = DATE_ADD(COALESCE(last_inbound_at, UTC_TIMESTAMP()), INTERVAL ? MINUTE)
         WHERE id = ? AND bot_paused = 0 AND bot_state IN ('idle', 'ready_for_owner')"
    );
    $stmt->execute([whatsapp_bot_delay_minutes(), $threadId]);
}

function whatsapp_bot_handle_inbound(PDO $pdo, int $threadId, string $body): void
{
    if (!whatsapp_bot_enabled()) {
        return;
    }
    $stmt = $pdo->prepare('SELECT * FROM whatsapp_threads WHERE id = ?');
    $stmt->execute([$threadId]);
    $thread = $stmt->fetch();
    if (!$thread || !empty($thread['bot_paused'])) {
        return;
    }

    $state = (string) ($thread['bot_state'] ?? 'idle');
    $data = whatsapp_bot_thread_data($thread);
    $waId = whatsapp_digits(whatsapp_decrypt_body(
        $thread['wa_id_ciphertext'] ?? null,
        $thread['wa_id_iv'] ?? null,
        $thread['wa_id_tag'] ?? null
    ));
    if ($waId === '') {
        return;
    }

    if ($state === 'awaiting_category') {
        [$category, $label, $issueCategory, $priority] = whatsapp_bot_category_from_text($body);
        $data = array_merge($data, [
            'category' => $category,
            'category_label' => $label,
            'issue_category' => $issueCategory,
            'priority' => $priority,
            'labels' => whatsapp_bot_merge_labels($data['labels'] ?? [], [$label], whatsapp_bot_labels_from_text($body)),
        ]);
        whatsapp_bot_save_data($pdo, $threadId, $data);
        [$categoryCiphertext, $categoryIv, $categoryTag] = whatsapp_encrypt_body($issueCategory);
        $update = $pdo->prepare(
            "UPDATE whatsapp_threads
             SET bot_state = 'awaiting_identity',
                 issue_category_ciphertext = ?, issue_category_iv = ?, issue_category_tag = ?,
                 priority = ?, requires_attention = 1, bot_next_action_at = NULL
             WHERE id = ?"
        );
        $update->execute([$categoryCiphertext, $categoryIv, $categoryTag, $priority, $threadId]);
        whatsapp_bot_send_text($pdo, $threadId, $waId, whatsapp_bot_prompt_identity());
        return;
    }

    if ($state === 'awaiting_identity') {
        $data = array_merge($data, whatsapp_bot_extract_identity($body));
        $data['labels'] = whatsapp_bot_merge_labels($data['labels'] ?? [], ['dane pacjenta'], whatsapp_bot_labels_from_text($body));
        whatsapp_bot_save_data($pdo, $threadId, $data);
        $update = $pdo->prepare("UPDATE whatsapp_threads SET bot_state = 'awaiting_details', requires_attention = 1 WHERE id = ?");
        $update->execute([$threadId]);
        whatsapp_bot_send_text($pdo, $threadId, $waId, whatsapp_bot_prompt_details());
        return;
    }

    if ($state === 'awaiting_details' || $state === 'ready_for_owner') {
        $previous = trim((string) ($data['details'] ?? ''));
        $data['details'] = $previous === '' ? trim($body) : $previous . "\n\nDopisano: " . trim($body);
        $data['labels'] = whatsapp_bot_merge_labels($data['labels'] ?? [], whatsapp_bot_labels_from_text($body));
        $summary = whatsapp_bot_summary($data);
        whatsapp_bot_save_data($pdo, $threadId, $data);
        whatsapp_bot_save_summary($pdo, $threadId, $summary);
        $priority = trim((string) ($data['priority'] ?? 'normal')) ?: 'normal';
        $update = $pdo->prepare(
            "UPDATE whatsapp_threads
             SET bot_state = 'ready_for_owner', requires_attention = 1, priority = ?, bot_next_action_at = NULL
             WHERE id = ?"
        );
        $update->execute([$priority, $threadId]);
        whatsapp_bot_upsert_intent($pdo, $threadId, $thread, $data);
        if ($state !== 'ready_for_owner') {
            whatsapp_bot_send_text($pdo, $threadId, $waId, whatsapp_bot_done_text());
        }
        return;
    }

    whatsapp_bot_arm_after_inbound($pdo, $threadId);
}

function whatsapp_bot_start_thread(PDO $pdo, array $thread): bool
{
    $threadId = (int) ($thread['id'] ?? 0);
    $waId = whatsapp_digits(whatsapp_decrypt_body(
        $thread['wa_id_ciphertext'] ?? null,
        $thread['wa_id_iv'] ?? null,
        $thread['wa_id_tag'] ?? null
    ));
    if ($threadId <= 0 || $waId === '') {
        return false;
    }
    $lastInbound = whatsapp_bot_last_inbound_body($pdo, $threadId);
    $detected = whatsapp_bot_detect_category_from_context($lastInbound);
    if ($detected !== null) {
        [$category, $label, $issueCategory, $priority] = $detected;
        $data = [
            'category' => $category,
            'category_label' => $label,
            'issue_category' => $issueCategory,
            'priority' => $priority,
            'context_message' => $lastInbound,
            'labels' => whatsapp_bot_merge_labels([$label], whatsapp_bot_labels_from_text($lastInbound)),
        ];
        whatsapp_bot_save_data($pdo, $threadId, $data);
        [$categoryCiphertext, $categoryIv, $categoryTag] = whatsapp_encrypt_body($issueCategory);
        $stmt = $pdo->prepare(
            "UPDATE whatsapp_threads
             SET bot_state = 'awaiting_identity',
                 issue_category_ciphertext = ?, issue_category_iv = ?, issue_category_tag = ?,
                 priority = ?,
                 requires_attention = 1,
                 bot_next_action_at = NULL
             WHERE id = ?"
        );
        $stmt->execute([$categoryCiphertext, $categoryIv, $categoryTag, $priority, $threadId]);
        $body = whatsapp_bot_first_reply() . "\n\nWidzę, że sprawa dotyczy: {$label}.\n\n" . whatsapp_bot_prompt_identity();
        return whatsapp_bot_send_text($pdo, $threadId, $waId, $body);
    }

    $body = whatsapp_bot_first_reply() . "\n\nNie mam jeszcze pewności, czego dotyczy sprawa.\n\n" . whatsapp_bot_menu_text();
    if (!whatsapp_bot_send_text($pdo, $threadId, $waId, $body)) {
        return false;
    }
    $stmt = $pdo->prepare(
        "UPDATE whatsapp_threads
         SET bot_state = 'awaiting_category',
             requires_attention = 1,
             bot_next_action_at = NULL
         WHERE id = ?"
    );
    $stmt->execute([$threadId]);
    return true;
}

function whatsapp_bot_run(PDO $pdo, int $limit = 20): array
{
    if (!whatsapp_bot_enabled()) {
        return ['ok' => false, 'sent' => 0, 'error' => 'Bot WhatsApp nie jest skonfigurowany.'];
    }
    $limit = max(1, min(50, $limit));
    $delay = whatsapp_bot_delay_minutes();
    $stmt = $pdo->prepare(
        "SELECT t.*
         FROM whatsapp_threads t
         WHERE t.bot_paused = 0
           AND t.bot_state IN ('idle', 'ready_for_owner')
           AND t.last_inbound_at IS NOT NULL
           AND t.last_inbound_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
           AND (t.bot_last_auto_reply_at IS NULL OR t.bot_last_auto_reply_at < t.last_inbound_at)
           AND NOT EXISTS (
               SELECT 1 FROM whatsapp_messages m
               WHERE m.thread_id = t.id
                 AND m.direction = 'outbound'
                 AND m.sent_at >= t.last_inbound_at
           )
         ORDER BY t.last_inbound_at ASC
         LIMIT {$limit}"
    );
    $stmt->execute([$delay]);
    $sent = 0;
    foreach ($stmt->fetchAll() as $thread) {
        if (whatsapp_bot_start_thread($pdo, $thread)) {
            $sent++;
        }
    }
    return ['ok' => true, 'sent' => $sent, 'delay_minutes' => $delay];
}

function whatsapp_handle_bot_run_route(string $method): void
{
    global $config;
    if ($method !== 'GET' && $method !== 'POST') {
        json_response(['error' => 'Method not allowed'], 405);
    }
    $expected = trim((string) ($config['whatsapp_bot_run_token'] ?? ''));
    $given = trim((string) ($_GET['token'] ?? $_SERVER['HTTP_X_BOT_TOKEN'] ?? ''));
    if ($expected === '' || $given === '' || !hash_equals($expected, $given)) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    json_response(whatsapp_bot_run(db()));
}

function whatsapp_store_message(
    PDO $pdo,
    array $message,
    array $contacts,
    bool $history
): bool {
    global $config;

    $metaId = trim((string) ($message['id'] ?? ''));
    $sentAt = whatsapp_message_datetime($message['timestamp'] ?? null);
    if ($metaId === '' || $sentAt === null) {
        return false;
    }
    $cutoff = time() - whatsapp_retention_days() * 86400;
    if (strtotime($sentAt . ' UTC') < $cutoff) {
        return false;
    }

    $business = whatsapp_digits((string) ($config['whatsapp_business_number'] ?? ''));
    $from = whatsapp_digits((string) ($message['from'] ?? ''));
    $to = whatsapp_digits((string) (
        $message['to']
        ?? $message['recipient_id']
        ?? $message['context']['to']
        ?? ''
    ));
    $direction = ($business !== '' && $from === $business) ? 'outbound' : 'inbound';
    $waId = $direction === 'outbound' ? $to : $from;
    if ($waId === '' || ($business !== '' && $waId === $business)) {
        return false;
    }

    $duplicate = $pdo->prepare('SELECT id FROM whatsapp_messages WHERE meta_message_id = ? LIMIT 1');
    $duplicate->execute([$metaId]);
    if ($duplicate->fetchColumn()) {
        return false;
    }

    $profileName = trim((string) ($contacts[$waId] ?? ''));
    $patient = whatsapp_find_patient($pdo, $waId);
    $body = whatsapp_extract_message_body($message);
    $type = trim((string) ($message['type'] ?? 'text')) ?: 'text';
    $category = $direction === 'inbound' ? whatsapp_issue_category($body) : 'inna';
    $shouldRunBot = $direction === 'inbound' && !$history;
    [$ciphertext, $iv, $tag] = whatsapp_encrypt_body($body);
    $waHash = whatsapp_lookup_hash('wa-id', $waId);
    [$waCiphertext, $waIv, $waTag] = whatsapp_encrypt_body($waId);
    [$profileCiphertext, $profileIv, $profileTag] = whatsapp_encrypt_body($profileName);
    $patientName = trim((string) ($patient['patient_name'] ?? ''));
    $bookingId = trim((string) ($patient['booking_id'] ?? ''));
    [$patientCiphertext, $patientIv, $patientTag] = whatsapp_encrypt_body($patientName);
    [$bookingCiphertext, $bookingIv, $bookingTag] = whatsapp_encrypt_body($bookingId);
    [$categoryCiphertext, $categoryIv, $categoryTag] = whatsapp_encrypt_body($category);
    $replyTo = trim((string) ($message['context']['id'] ?? ''));

    $pdo->beginTransaction();
    try {
        $thread = $pdo->prepare(
            "INSERT INTO whatsapp_threads
                (wa_id_hash, wa_id_ciphertext, wa_id_iv, wa_id_tag,
                 profile_name_ciphertext, profile_name_iv, profile_name_tag,
                 patient_name_ciphertext, patient_name_iv, patient_name_tag,
                 booking_id_ciphertext, booking_id_iv, booking_id_tag, is_patient,
                 issue_category_ciphertext, issue_category_iv, issue_category_tag, last_message_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                id = LAST_INSERT_ID(id),
                wa_id_ciphertext = VALUES(wa_id_ciphertext),
                wa_id_iv = VALUES(wa_id_iv),
                wa_id_tag = VALUES(wa_id_tag),
                profile_name_ciphertext = COALESCE(VALUES(profile_name_ciphertext), profile_name_ciphertext),
                profile_name_iv = COALESCE(VALUES(profile_name_iv), profile_name_iv),
                profile_name_tag = COALESCE(VALUES(profile_name_tag), profile_name_tag),
                patient_name_ciphertext = COALESCE(VALUES(patient_name_ciphertext), patient_name_ciphertext),
                patient_name_iv = COALESCE(VALUES(patient_name_iv), patient_name_iv),
                patient_name_tag = COALESCE(VALUES(patient_name_tag), patient_name_tag),
                booking_id_ciphertext = COALESCE(VALUES(booking_id_ciphertext), booking_id_ciphertext),
                booking_id_iv = COALESCE(VALUES(booking_id_iv), booking_id_iv),
                booking_id_tag = COALESCE(VALUES(booking_id_tag), booking_id_tag),
                is_patient = GREATEST(is_patient, VALUES(is_patient))"
        );
        $thread->execute([
            $waHash,
            $waCiphertext,
            $waIv,
            $waTag,
            $profileCiphertext,
            $profileIv,
            $profileTag,
            $patientCiphertext,
            $patientIv,
            $patientTag,
            $bookingCiphertext,
            $bookingIv,
            $bookingTag,
            $bookingId !== '' ? 1 : 0,
            $categoryCiphertext,
            $categoryIv,
            $categoryTag,
            $sentAt,
        ]);
        $threadId = (int) $pdo->lastInsertId();

        $insert = $pdo->prepare(
            "INSERT IGNORE INTO whatsapp_messages
                (thread_id, meta_message_id, direction, message_type, body_ciphertext, body_iv, body_tag,
                 status_name, reply_to_meta_id, sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $insert->execute([
            $threadId,
            $metaId,
            $direction,
            $type,
            $ciphertext,
            $iv,
            $tag,
            $direction === 'outbound' ? 'sent' : 'received',
            $replyTo !== '' ? $replyTo : null,
            $sentAt,
        ]);
        if ($insert->rowCount() === 0) {
            $pdo->rollBack();
            return false;
        }
        $messageId = (int) $pdo->lastInsertId();

        if ($direction === 'inbound') {
            $update = $pdo->prepare(
                "UPDATE whatsapp_threads
                 SET issue_category_ciphertext = IF(
                         last_inbound_at IS NULL OR last_inbound_at <= ?,
                         ?,
                         issue_category_ciphertext
                     ),
                     issue_category_iv = IF(
                         last_inbound_at IS NULL OR last_inbound_at <= ?,
                         ?,
                         issue_category_iv
                     ),
                     issue_category_tag = IF(
                         last_inbound_at IS NULL OR last_inbound_at <= ?,
                         ?,
                         issue_category_tag
                     ),
                     last_inbound_at = IF(last_inbound_at IS NULL OR last_inbound_at < ?, ?, last_inbound_at),
                     unread_count = unread_count + ?,
                     last_message_id = IF(last_message_at <= ?, ?, last_message_id),
                     last_message_at = GREATEST(last_message_at, ?)
                 WHERE id = ?"
            );
            $update->execute([
                $sentAt,
                $categoryCiphertext,
                $sentAt,
                $categoryIv,
                $sentAt,
                $categoryTag,
                $sentAt,
                $sentAt,
                $history ? 0 : 1,
                $sentAt,
                $messageId,
                $sentAt,
                $threadId,
            ]);
        } else {
            $update = $pdo->prepare(
                "UPDATE whatsapp_threads
                 SET last_message_id = IF(last_message_at <= ?, ?, last_message_id),
                     last_message_at = GREATEST(last_message_at, ?)
                 WHERE id = ?"
            );
            $update->execute([$sentAt, $messageId, $sentAt, $threadId]);
        }
        $pdo->commit();
        if ($shouldRunBot) {
            try {
                whatsapp_bot_handle_inbound($pdo, $threadId, $body);
            } catch (Throwable $error) {
                error_log('WhatsApp bot failed: ' . $error->getMessage());
            }
        }
        return true;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function whatsapp_store_status(PDO $pdo, array $status): void
{
    $metaId = trim((string) ($status['id'] ?? ''));
    $name = trim((string) ($status['status'] ?? ''));
    if ($metaId === '' || $name === '') {
        return;
    }
    $at = whatsapp_message_datetime($status['timestamp'] ?? null) ?? gmdate('Y-m-d H:i:s');
    $stmt = $pdo->prepare(
        'UPDATE whatsapp_messages SET status_name = ?, status_at = ? WHERE meta_message_id = ?'
    );
    $stmt->execute([$name, $at, $metaId]);
}

function whatsapp_cleanup(PDO $pdo): void
{
    $days = whatsapp_retention_days();
    $pdo->exec("DELETE FROM whatsapp_messages WHERE sent_at < UTC_TIMESTAMP() - INTERVAL {$days} DAY");
    $pdo->exec(
        'DELETE t FROM whatsapp_threads t
         LEFT JOIN whatsapp_messages m ON m.thread_id = t.id
         WHERE m.id IS NULL AND t.is_patient = 0'
    );
}

function whatsapp_cleanup_maybe_run_silent(): void
{
    global $config;
    $interval = max(900, (int) ($config['whatsapp_cleanup_interval_seconds'] ?? 21600));
    $statePath = secure_runtime_dir('whatsapp-cleanup') . DIRECTORY_SEPARATOR . 'last-run';
    $lastRun = is_file($statePath) ? (int) trim((string) @file_get_contents($statePath)) : 0;
    if ($lastRun > time() - $interval) {
        return;
    }

    $handle = @fopen($statePath, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX | LOCK_NB)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        return;
    }
    try {
        rewind($handle);
        $stored = (int) trim((string) stream_get_contents($handle));
        if ($stored <= time() - $interval) {
            whatsapp_cleanup(db());
            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, (string) time());
            fflush($handle);
            @chmod($statePath, 0600);
        }
    } catch (Throwable $error) {
        error_log('WhatsApp cleanup failed: ' . $error->getMessage());
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function whatsapp_handle_cleanup_route(string $method): void
{
    global $config;
    if ($method !== 'GET' && $method !== 'POST') {
        json_response(['error' => 'Method not allowed'], 405);
    }
    $expected = trim((string) ($config['whatsapp_cleanup_token'] ?? ''));
    $given = trim((string) ($_GET['token'] ?? $_SERVER['HTTP_X_CLEANUP_TOKEN'] ?? ''));
    if ($expected === '' || $given === '' || !hash_equals($expected, $given)) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    whatsapp_cleanup(db());
    json_response(['ok' => true]);
}

function whatsapp_iso(?string $value): ?string
{
    if ($value === null || trim($value) === '') {
        return null;
    }
    return str_replace(' ', 'T', trim($value)) . 'Z';
}

function whatsapp_thread_row(array $row): array
{
    $waId = whatsapp_decrypt_body(
        $row['wa_id_ciphertext'] ?? null,
        $row['wa_id_iv'] ?? null,
        $row['wa_id_tag'] ?? null
    );
    $profileName = whatsapp_decrypt_body(
        $row['profile_name_ciphertext'] ?? null,
        $row['profile_name_iv'] ?? null,
        $row['profile_name_tag'] ?? null
    );
    $patientName = whatsapp_decrypt_body(
        $row['patient_name_ciphertext'] ?? null,
        $row['patient_name_iv'] ?? null,
        $row['patient_name_tag'] ?? null
    );
    $issueCategory = whatsapp_decrypt_body(
        $row['issue_category_ciphertext'] ?? null,
        $row['issue_category_iv'] ?? null,
        $row['issue_category_tag'] ?? null
    );
    $triageSummary = whatsapp_decrypt_body(
        $row['triage_summary_ciphertext'] ?? null,
        $row['triage_summary_iv'] ?? null,
        $row['triage_summary_tag'] ?? null
    );
    $botData = whatsapp_bot_thread_data($row);
    $waId = whatsapp_digits($waId);
    $profileName = trim($profileName);
    $patientName = trim($patientName);
    $triageSummary = trim($triageSummary);
    $labels = is_array($botData['labels'] ?? null) ? array_values(array_filter(array_map(
        static fn($label): string => trim((string) $label),
        $botData['labels']
    ))) : [];
    $lastInbound = isset($row['last_inbound_at']) ? strtotime((string) $row['last_inbound_at'] . ' UTC') : false;
    return [
        'id' => (int) $row['id'],
        'wa_id' => $waId,
        'phone' => $waId !== '' ? '+' . $waId : '',
        'display_name' => $patientName !== '' ? $patientName : ($profileName !== '' ? $profileName : '+' . $waId),
        'profile_name' => $profileName !== '' ? $profileName : null,
        'patient_name' => $patientName !== '' ? $patientName : null,
        'is_patient' => !empty($row['is_patient']),
        'issue_category' => $issueCategory !== '' ? $issueCategory : 'inna',
        'triage_summary' => $triageSummary !== '' ? $triageSummary : null,
        'requires_attention' => !empty($row['requires_attention']),
        'priority' => (string) ($row['priority'] ?? 'normal'),
        'bot_state' => (string) ($row['bot_state'] ?? 'idle'),
        'bot_paused' => !empty($row['bot_paused']),
        'bot_last_auto_reply_at' => whatsapp_iso($row['bot_last_auto_reply_at'] ?? null),
        'bot_data' => $botData !== [] ? $botData : null,
        'labels' => $labels,
        'preview' => whatsapp_decrypt_body(
            $row['body_ciphertext'] ?? null,
            $row['body_iv'] ?? null,
            $row['body_tag'] ?? null
        ),
        'last_direction' => (string) ($row['direction'] ?? 'inbound'),
        'last_message_type' => (string) ($row['message_type'] ?? 'text'),
        'last_message_at' => whatsapp_iso((string) ($row['last_message_at'] ?? '')),
        'last_inbound_at' => whatsapp_iso($row['last_inbound_at'] ?? null),
        'unread_count' => (int) ($row['unread_count'] ?? 0),
        'can_reply' => $lastInbound !== false && $lastInbound >= time() - 86400,
        'whatsapp_url' => 'https://wa.me/' . rawurlencode($waId),
    ];
}

function whatsapp_list_threads(PDO $pdo, int $limit = 50): array
{
    whatsapp_cleanup($pdo);
    $limit = max(1, min(100, $limit));
    $stmt = $pdo->query(
        "SELECT t.*, m.direction, m.message_type, m.body_ciphertext, m.body_iv, m.body_tag
         FROM whatsapp_threads t
         LEFT JOIN whatsapp_messages m ON m.id = t.last_message_id
         ORDER BY t.last_message_at DESC, t.id DESC
         LIMIT {$limit}"
    );
    return array_map('whatsapp_thread_row', $stmt->fetchAll());
}

function whatsapp_list_messages(PDO $pdo, int $threadId): array
{
    whatsapp_cleanup($pdo);
    $thread = $pdo->prepare(
        "SELECT t.*, m.direction, m.message_type, m.body_ciphertext, m.body_iv, m.body_tag
         FROM whatsapp_threads t
         LEFT JOIN whatsapp_messages m ON m.id = t.last_message_id
         WHERE t.id = ?"
    );
    $thread->execute([$threadId]);
    $threadRow = $thread->fetch();
    if (!$threadRow) {
        json_response(['error' => 'Nie znaleziono wątku.'], 404);
    }
    $stmt = $pdo->prepare(
        "SELECT id, meta_message_id, direction, message_type, body_ciphertext, body_iv, body_tag,
                status_name, reply_to_meta_id, sent_at
         FROM whatsapp_messages
         WHERE thread_id = ?
         ORDER BY sent_at ASC, id ASC
         LIMIT 300"
    );
    $stmt->execute([$threadId]);
    $messages = [];
    foreach ($stmt as $row) {
        $messages[] = [
            'id' => (int) $row['id'],
            'meta_message_id' => (string) $row['meta_message_id'],
            'direction' => (string) $row['direction'],
            'message_type' => (string) $row['message_type'],
            'body' => whatsapp_decrypt_body(
                $row['body_ciphertext'],
                $row['body_iv'],
                $row['body_tag']
            ),
            'status' => (string) $row['status_name'],
            'reply_to_meta_id' => $row['reply_to_meta_id'] ?: null,
            'sent_at' => whatsapp_iso((string) $row['sent_at']),
        ];
    }
    return [
        'thread' => whatsapp_thread_row($threadRow),
        'messages' => $messages,
    ];
}

function whatsapp_reply_to_thread(PDO $pdo, int $threadId, string $body): array
{
    global $config;
    $body = trim($body);
    $length = function_exists('mb_strlen') ? mb_strlen($body, 'UTF-8') : strlen($body);
    if ($body === '' || $length > 1500) {
        json_response(['error' => 'Wiadomość musi mieć od 1 do 1500 znaków.'], 400);
    }
    $stmt = $pdo->prepare('SELECT * FROM whatsapp_threads WHERE id = ?');
    $stmt->execute([$threadId]);
    $thread = $stmt->fetch();
    if (!$thread) {
        json_response(['error' => 'Nie znaleziono wątku.'], 404);
    }
    $waId = whatsapp_digits(whatsapp_decrypt_body(
        $thread['wa_id_ciphertext'] ?? null,
        $thread['wa_id_iv'] ?? null,
        $thread['wa_id_tag'] ?? null
    ));
    if ($waId === '') {
        json_response(['error' => 'Nie udało się odczytać numeru odbiorcy.'], 500);
    }
    $lastInbound = strtotime((string) ($thread['last_inbound_at'] ?? '') . ' UTC');
    if ($lastInbound === false || $lastInbound < time() - 86400) {
        json_response([
            'error' => 'Minęło 24-godzinne okno odpowiedzi. Otwórz rozmowę w WhatsApp Business.',
            'whatsapp_url' => 'https://wa.me/' . rawurlencode($waId),
        ], 409);
    }

    $result = whatsapp_send_text_result($waId, $body);
    if (empty($result['ok']) || empty($result['id'])) {
        json_response(['error' => (string) ($result['error'] ?? 'Nie udało się wysłać wiadomości.')], 502);
    }
    $message = [
        'id' => (string) $result['id'],
        'timestamp' => time(),
        'from' => whatsapp_digits((string) ($config['whatsapp_business_number'] ?? '')),
        'to' => $waId,
        'type' => 'text',
        'text' => ['body' => $body],
    ];
    whatsapp_store_message($pdo, $message, [], false);
    $pause = $pdo->prepare(
        "UPDATE whatsapp_threads
         SET bot_state = 'owner_replied',
             bot_paused = 1,
             requires_attention = 0,
             bot_next_action_at = NULL
         WHERE id = ?"
    );
    $pause->execute([$threadId]);
    return whatsapp_list_messages($pdo, $threadId);
}

function whatsapp_handle_webhook(string $method): void
{
    global $config;

    if ($method === 'GET') {
        $mode = (string) ($_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '');
        $token = (string) ($_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '');
        $challenge = (string) ($_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '');
        $expected = trim((string) ($config['whatsapp_webhook_verify_token'] ?? ''));
        if ($mode === 'subscribe' && $expected !== '' && hash_equals($expected, $token)) {
            header('Content-Type: text/plain; charset=utf-8');
            echo $challenge;
            exit;
        }
        json_response(['error' => 'Webhook verification failed'], 403);
    }

    if ($method !== 'POST') {
        json_response(['error' => 'Method not allowed'], 405);
    }
    $rate = rate_limit_consume(
        'whatsapp-webhook',
        max(60, (int) ($config['whatsapp_webhook_rate_limit'] ?? 1800)),
        max(10, (int) ($config['whatsapp_webhook_rate_window_seconds'] ?? 60))
    );
    if (empty($rate['allowed'])) {
        header('Retry-After: ' . (int) ($rate['retry_after'] ?? 60));
        json_response(['error' => 'Too many webhook requests'], 429);
    }

    $maxBytes = max(65536, (int) ($config['whatsapp_webhook_max_bytes'] ?? 8388608));
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > $maxBytes) {
        json_response(['error' => 'Payload too large'], 413);
    }
    $raw = file_get_contents('php://input') ?: '';
    if (strlen($raw) > $maxBytes) {
        json_response(['error' => 'Payload too large'], 413);
    }
    $appSecret = trim((string) ($config['whatsapp_app_secret'] ?? ''));
    $signature = trim((string) ($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? ''));
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $raw, $appSecret);
    if ($appSecret === '' || $signature === '' || !hash_equals($expectedSignature, $signature)) {
        json_response(['error' => 'Invalid signature'], 401);
    }
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        json_response(['error' => 'Invalid JSON'], 400);
    }

    $pdo = db();
    $contacts = [];
    $messages = [];
    $statuses = [];
    whatsapp_collect_configured_phone_payload($payload, $contacts, $messages, $statuses);
    foreach ($messages as $item) {
        whatsapp_store_message(
            $pdo,
            (array) ($item['message'] ?? []),
            $contacts,
            (bool) ($item['history'] ?? false)
        );
    }
    foreach ($statuses as $status) {
        whatsapp_store_status($pdo, $status);
    }
    whatsapp_cleanup($pdo);
    json_response(['ok' => true]);
}

function whatsapp_handle_admin_route(string $route, string $method): bool
{
    if (strpos($route, '/admin/whatsapp') !== 0) {
        return false;
    }

    require_admin();
    $pdo = db();

    if ($route === '/admin/whatsapp/status' && $method === 'GET') {
        json_response([
            'sending_configured' => whatsapp_configured(),
            'threads_configured' => whatsapp_messages_configured(),
            'retention_days' => whatsapp_retention_days(),
        ]);
    }
    if ($route === '/admin/whatsapp/threads' && $method === 'GET') {
        json_response(whatsapp_list_threads($pdo, (int) ($_GET['limit'] ?? 50)));
    }
    if (preg_match('#^/admin/whatsapp/threads/(\d+)/messages$#', $route, $matches)) {
        $threadId = (int) $matches[1];
        if ($method === 'GET') {
            json_response(whatsapp_list_messages($pdo, $threadId));
        }
    }
    if (preg_match('#^/admin/whatsapp/threads/(\d+)/read$#', $route, $matches) && $method === 'POST') {
        $stmt = $pdo->prepare('UPDATE whatsapp_threads SET unread_count = 0 WHERE id = ?');
        $stmt->execute([(int) $matches[1]]);
        json_response(['ok' => true]);
    }
    if (preg_match('#^/admin/whatsapp/threads/(\d+)/bot/done$#', $route, $matches) && $method === 'POST') {
        $stmt = $pdo->prepare(
            "UPDATE whatsapp_threads
             SET bot_state = 'owner_replied',
                 bot_paused = 1,
                 requires_attention = 0,
                 bot_next_action_at = NULL
             WHERE id = ?"
        );
        $stmt->execute([(int) $matches[1]]);
        json_response(whatsapp_list_messages($pdo, (int) $matches[1]));
    }
    if (preg_match('#^/admin/whatsapp/threads/(\d+)/reply$#', $route, $matches) && $method === 'POST') {
        $data = json_input();
        json_response(whatsapp_reply_to_thread(
            $pdo,
            (int) $matches[1],
            (string) ($data['body'] ?? '')
        ));
    }

    json_response(['error' => 'Not found'], 404);
    return true;
}
