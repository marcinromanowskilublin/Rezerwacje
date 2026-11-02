<?php
declare(strict_types=1);

function visit_report_recipients(): array
{
    global $config;
    $configured = $config['visit_report_emails'] ?? [
        'marcin.romanowski.lublin@gmail.com',
        'zalef87@gmail.com',
    ];
    if (is_string($configured)) {
        $configured = preg_split('/\s*,\s*/', $configured) ?: [];
    }
    $emails = [];
    foreach ((array) $configured as $email) {
        $email = trim((string) $email);
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $emails[$email] = $email;
        }
    }
    return array_values($emails);
}

function visit_report_hour(): int
{
    global $config;
    $hour = (int) ($config['visit_report_hour'] ?? 6);
    return max(0, min(23, $hour));
}

function visit_report_start_date(): string
{
    global $config;
    $date = trim((string) ($config['visit_report_start_date'] ?? '2026-11-01'));
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? $date : '2026-11-01';
}

function visit_report_cancel_password(): string
{
    global $config;
    $password = trim((string) ($config['visit_report_cancel_password'] ?? '12345'));
    return $password !== '' ? $password : '12345';
}

function visit_report_signing_key(): string
{
    global $config;
    $configured = trim((string) ($config['visit_report_signing_key'] ?? ''));
    if ($configured !== '') {
        return $configured;
    }
    $adminPassword = trim((string) ($config['admin_password'] ?? ''));
    if ($adminPassword !== '') {
        return $adminPassword;
    }
    return 'visit-report-default-key';
}

function visit_report_sign_token(string $token): string
{
    return hash_hmac('sha256', $token, visit_report_signing_key());
}

function visit_report_signature_ok(string $token, string $signature): bool
{
    if ($token === '' || $signature === '') {
        return false;
    }
    return hash_equals(visit_report_sign_token($token), $signature);
}

function visit_report_public_base_url(): string
{
    global $config;
    $configured = trim((string) ($config['public_base_url'] ?? ''));
    if ($configured !== '') {
        return rtrim($configured, '/');
    }
    $https = (string) ($_SERVER['HTTPS'] ?? '');
    $scheme = ($https !== '' && strtolower($https) !== 'off') ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    return $scheme . '://' . $host;
}

function visit_report_cancel_url(string $token): string
{
    return visit_report_public_base_url()
        . '/rezerwacja/api/visit-report/cancel?token=' . rawurlencode($token)
        . '&sig=' . rawurlencode(visit_report_sign_token($token));
}

function visit_report_manage_url(string $token): string
{
    return public_app_url('manage/' . rawurlencode($token));
}

function visit_report_state_path(): string
{
    return dirname(__DIR__) . '/storage/visit-reports/last.json';
}

function visit_report_read_state(): array
{
    $path = visit_report_state_path();
    if (!is_file($path)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : [];
}

function visit_report_write_state(array $state): void
{
    $path = visit_report_state_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
        return;
    }
    file_put_contents($path, json_encode($state, JSON_UNESCAPED_UNICODE));
}

function visit_report_date_label(string $date): string
{
    $ts = strtotime($date . ' 12:00:00') ?: time();
    $weekdays = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
    $months = [
        1 => 'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
        'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
    ];
    $weekday = $weekdays[(int) date('w', $ts)];
    $day = (int) date('j', $ts);
    $month = $months[(int) date('n', $ts)] ?? '';
    return $weekday . ', ' . $day . ' ' . $month . ' ' . date('Y', $ts);
}

function visit_report_status_label(string $status): string
{
    $labels = [
        'confirmed' => 'potwierdzona',
        'pending' => 'oczekuje',
        'pending_payment' => 'oczekuje na płatność',
        'completed' => 'zakończona',
        'no_show' => 'nieobecność',
        'cancelled' => 'anulowana',
    ];
    return $labels[$status] ?? $status;
}

function visit_report_h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function visit_report_phone_digits(string $value): string
{
    $digits = preg_replace('/\D+/', '', $value) ?: '';
    if ($digits === '') {
        return '';
    }
    if (strlen($digits) === 9) {
        $digits = '48' . $digits;
    }
    return $digits;
}

function visit_report_contact_links(array $booking): array
{
    $links = [];
    $name = trim((string) ($booking['patient'] ?? 'Pacjent'));
    $time = trim((string) ($booking['time'] ?? ''));

    $email = trim((string) ($booking['email'] ?? ''));
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $subject = rawurlencode('Wizyta ' . $time);
        $body = rawurlencode('Dzień dobry, ' . $name . '.');
        $links['mail'] = 'mailto:' . $email . '?subject=' . $subject . '&body=' . $body;
    }

    $digits = visit_report_phone_digits((string) ($booking['phone'] ?? ''));
    if ($digits !== '') {
        $tel = '+' . $digits;
        $message = rawurlencode('Dzień dobry, ' . $name . '. Wiadomość w sprawie wizyty ' . $time . '.');
        $links['tel'] = 'tel:' . $tel;
        $links['sms'] = 'sms:' . $tel . '?body=' . $message;
        $links['wa'] = 'https://wa.me/' . $digits . '?text=' . $message;
    }

    $token = trim((string) ($booking['token'] ?? ''));
    if ($token !== '' && ($booking['status_raw'] ?? '') !== 'cancelled') {
        $links['cancel'] = visit_report_cancel_url($token);
        $links['manage'] = visit_report_manage_url($token);
    }

    return $links;
}

function visit_report_fetch_booking_by_token(PDO $pdo, string $token): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE management_token = ?');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    return $row ? normalize_booking($row) : null;
}

function visit_report_bookings(PDO $pdo, string $date): array
{
    $stmt = $pdo->prepare(
        'SELECT b.id, b.start_time, b.end_time, b.status, b.patient_name, b.patient_email, b.patient_phone, b.management_token,
                v.name AS visit_name, v.duration_minutes
         FROM bookings b
         LEFT JOIN visit_types v ON v.id = b.visit_type_id
         WHERE b.booking_date = ? AND b.status != \'cancelled\'
         ORDER BY b.start_time ASC'
    );
    $stmt->execute([$date]);

    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $start = minutes((string) $row['start_time']);
        $endTime = (string) ($row['end_time'] ?? '');
        $duration = (int) ($row['duration_minutes'] ?? 30);
        $end = ($endTime !== '' && hm($endTime) !== hm((string) $row['start_time']))
            ? minutes($endTime)
            : $start + max(1, $duration);
        $rows[] = [
            'id' => (string) $row['id'],
            'start' => $start,
            'end' => $end,
            'time' => from_minutes($start) . '–' . from_minutes($end),
            'status' => visit_report_status_label((string) $row['status']),
            'status_raw' => (string) $row['status'],
            'patient' => trim((string) ($row['patient_name'] ?? '')),
            'email' => trim((string) ($row['patient_email'] ?? '')),
            'phone' => trim((string) ($row['patient_phone'] ?? '')),
            'token' => trim((string) ($row['management_token'] ?? '')),
            'visit' => trim((string) ($row['visit_name'] ?? '')),
        ];
    }

    return $rows;
}

function visit_report_blocks(PDO $pdo, string $date): array
{
    $stmt = $pdo->prepare('SELECT start_time, end_time FROM blocked_periods WHERE date = ?');
    $stmt->execute([$date]);
    $ranges = [];
    foreach ($stmt->fetchAll() as $row) {
        $ranges[] = [minutes((string) $row['start_time']), minutes((string) $row['end_time'])];
    }
    return $ranges;
}

function visit_report_day(PDO $pdo, string $date): array
{
    $bookings = visit_report_bookings($pdo, $date);
    $blocks = visit_report_blocks($pdo, $date);

    $dayOfWeek = (int) date('w', strtotime($date . ' 12:00:00'));
    $rules = $pdo->prepare('SELECT * FROM availability_rules WHERE day_of_week = ? ORDER BY start_time');
    $rules->execute([$dayOfWeek]);

    $visitTypes = $pdo->query('SELECT * FROM visit_types WHERE active = 1')->fetchAll();

    $slots = [];
    foreach ($rules->fetchAll() as $rule) {
        $rule = normalize_booking($rule);
        $duration = 30;
        foreach ($visitTypes as $visitType) {
            $visitType = normalize_booking($visitType);
            if (rule_matches_visit($rule, $visitType)) {
                $duration = max(5, (int) $visitType['duration_minutes']);
                break;
            }
        }

        $step = max(5, (int) ($rule['slot_duration'] ?? $duration));
        $start = minutes((string) $rule['start_time']);
        $end = minutes((string) $rule['end_time']);

        for ($cursor = $start; $cursor + $duration <= $end; $cursor += $step) {
            $slotEnd = $cursor + $duration;
            $blocked = false;
            foreach ($blocks as [$bStart, $bEnd]) {
                if (ranges_overlap($cursor, $slotEnd, $bStart, $bEnd)) {
                    $blocked = true;
                    break;
                }
            }
            if ($blocked) {
                continue;
            }

            $key = from_minutes($cursor);
            if (!isset($slots[$key])) {
                $slots[$key] = [
                    'time' => $key . '–' . from_minutes($slotEnd),
                    'start' => $cursor,
                    'end' => $slotEnd,
                    'bookings' => [],
                ];
            }
        }
    }

    $used = [];
    foreach ($slots as &$slot) {
        foreach ($bookings as $booking) {
            if ((int) $booking['start'] === (int) $slot['start']) {
                $slot['bookings'][] = $booking;
                $used[$booking['id']] = true;
            }
        }
    }
    unset($slot);

    $rows = [];
    $free = 0;
    $taken = 0;
    foreach ($slots as $slot) {
        if ($slot['bookings'] === []) {
            $free++;
            $rows[] = [
                'time' => $slot['time'],
                'state' => 'wolny',
                'bookings' => [],
            ];
            continue;
        }
        $taken++;
        $rows[] = [
            'time' => $slot['time'],
            'state' => 'zajęty',
            'bookings' => $slot['bookings'],
        ];
    }

    $extra = [];
    foreach ($bookings as $booking) {
        if (!isset($used[$booking['id']])) {
            $extra[] = $booking;
        }
    }

    return [
        'date' => $date,
        'label' => visit_report_date_label($date),
        'weekend' => $dayOfWeek === 0 || $dayOfWeek === 6,
        'slot_count' => count($rows),
        'free_count' => $free,
        'taken_count' => $taken,
        'rows' => $rows,
        'extra' => $extra,
    ];
}

function visit_report_plain_day(array $day): string
{
    $text = $day['label'] . "\n";
    $text .= 'Slotów: ' . $day['slot_count'] . '. Wolnych: ' . $day['free_count'] . '. Zajętych: ' . $day['taken_count'] . ".\n";

    if ($day['slot_count'] === 0) {
        $text .= $day['weekend'] ? "Weekend — wolnych godzin nie ma.\n" : "W tym dniu nie ma godzin w grafiku.\n";
    } else {
        $text .= "\n";
        foreach ($day['rows'] as $row) {
            if ($row['state'] === 'wolny') {
                $text .= $row['time'] . ' | wolny' . "\n";
                continue;
            }
            foreach ($row['bookings'] as $booking) {
                $contacts = visit_report_contact_links($booking);
                $text .= $row['time'] . ' | zajęty | '
                    . ($booking['visit'] !== '' ? $booking['visit'] : 'wizyta') . ' (' . $booking['status'] . ') | '
                    . ($booking['patient'] !== '' ? $booking['patient'] : '—') . "\n";
                if (!empty($contacts['tel'])) {
                    $text .= '  tel: ' . $contacts['tel'] . "\n";
                }
                if (!empty($contacts['sms'])) {
                    $text .= '  sms: ' . $contacts['sms'] . "\n";
                }
                if (!empty($contacts['mail'])) {
                    $text .= '  mail: ' . $contacts['mail'] . "\n";
                }
                if (!empty($contacts['wa'])) {
                    $text .= '  wa: ' . $contacts['wa'] . "\n";
                }
                if (!empty($contacts['cancel'])) {
                    $text .= '  odwołaj: ' . $contacts['cancel'] . "\n";
                }
            }
        }
    }

    if ($day['extra'] !== []) {
        $text .= "\nZapisane poza siatką godzin:\n";
        foreach ($day['extra'] as $booking) {
            $text .= $booking['time'] . ' | ' . $booking['status'] . ' | '
                . ($booking['visit'] !== '' ? $booking['visit'] : 'wizyta') . ' | '
                . ($booking['patient'] !== '' ? $booking['patient'] : '—') . "\n";
        }
    }

    return $text . "\n";
}

function visit_report_actions_html(array $booking): string
{
    $h = 'visit_report_h';
    $links = visit_report_contact_links($booking);
    $parts = [];

    if (!empty($links['tel'])) {
        $parts[] = '<a style="display:inline-block;margin:2px 4px 2px 0;padding:4px 7px;border:1px solid #d8d6cf;border-radius:6px;color:#14332c;text-decoration:none;font-size:12px;" href="' . $h($links['tel']) . '">Telefon</a>';
    }
    if (!empty($links['sms'])) {
        $parts[] = '<a style="display:inline-block;margin:2px 4px 2px 0;padding:4px 7px;border:1px solid #d8d6cf;border-radius:6px;color:#14332c;text-decoration:none;font-size:12px;" href="' . $h($links['sms']) . '">SMS</a>';
    }
    if (!empty($links['mail'])) {
        $parts[] = '<a style="display:inline-block;margin:2px 4px 2px 0;padding:4px 7px;border:1px solid #d8d6cf;border-radius:6px;color:#14332c;text-decoration:none;font-size:12px;" href="' . $h($links['mail']) . '">E-mail</a>';
    }
    if (!empty($links['wa'])) {
        $parts[] = '<a style="display:inline-block;margin:2px 4px 2px 0;padding:4px 7px;border:1px solid #d8d6cf;border-radius:6px;color:#14332c;text-decoration:none;font-size:12px;" href="' . $h($links['wa']) . '">WhatsApp</a>';
    }
    if (!empty($links['cancel'])) {
        $parts[] = '<a style="display:inline-block;margin:2px 0;padding:4px 7px;border:1px solid #a04a3a;border-radius:6px;background:#fff5f2;color:#a04a3a;text-decoration:none;font-size:12px;font-weight:600;" href="' . $h($links['cancel']) . '">Odwołaj</a>';
    }

    if ($parts === []) {
        return '<span style="font-size:12px;color:#737373;">brak kontaktu</span>';
    }

    return implode('', $parts);
}

function visit_report_booking_list_html(array $bookings): array
{
    $h = 'visit_report_h';
    $visitHtml = '';
    $patientHtml = '';

    foreach ($bookings as $booking) {
        $visit = $booking['visit'] !== '' ? $booking['visit'] : 'wizyta';
        $visitHtml .= '<div style="margin:0 0 8px;line-height:1.35;">'
            . $h($visit)
            . ' <span style="color:#6b7280;">(' . $h($booking['status']) . ')</span>'
            . '</div>';

        $patientLabel = trim((string) ($booking['patient'] ?? ''));
        if ($patientLabel === '') {
            $patientLabel = '—';
        }
        $email = trim((string) ($booking['email'] ?? ''));
        $phone = trim((string) ($booking['phone'] ?? ''));

        $patientHtml .= '<div style="margin:0 0 10px;line-height:1.35;">'
            . '<div style="font-weight:500;color:#111827;">' . $h($patientLabel) . '</div>'
            . '<div style="font-size:12px;color:#6b7280;">'
            . ($phone !== '' ? $h($phone) : '—')
            . ($email !== '' ? ' · ' . $h($email) : '')
            . '</div>'
            . '<div style="margin-top:4px;">' . visit_report_actions_html($booking) . '</div>'
            . '</div>';
    }

    return [
        'visit' => $visitHtml,
        'patient' => $patientHtml,
    ];
}

function visit_report_html_day(array $day): string
{
    $h = 'visit_report_h';

    $html = '<h2 style="margin:24px 0 8px;font-size:18px;font-weight:500;color:#14332c;">' . $h($day['label']) . '</h2>';
    $html .= '<p style="margin:0 0 12px;font-size:14px;color:#3d4a46;">Slotów: <strong>' . (int) $day['slot_count']
        . '</strong> · Wolnych: <strong>' . (int) $day['free_count']
        . '</strong> · Zajętych: <strong>' . (int) $day['taken_count'] . '</strong></p>';

    if ($day['slot_count'] === 0) {
        $note = $day['weekend'] ? 'Weekend — wolnych godzin nie ma.' : 'W tym dniu nie ma godzin w grafiku.';
        $html .= '<p style="margin:0 0 12px;padding:12px 14px;background:#f4faf8;border-radius:8px;color:#14332c;">' . $h($note) . '</p>';
    } else {
        $html .= '<div style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
        $html .= '<table style="width:100%;min-width:640px;border-collapse:collapse;font-size:14px;">';
        $html .= '<thead><tr>';
        foreach (['Godzina', 'Stan', 'Wizyta', 'Pacjent i kontakt'] as $heading) {
            $html .= '<th style="text-align:left;padding:10px;background:#007865;color:#fff;font-weight:500;white-space:nowrap;">' . $heading . '</th>';
        }
        $html .= '</tr></thead><tbody>';

        foreach ($day['rows'] as $row) {
            if ($row['state'] === 'wolny') {
                $html .= '<tr style="background:#f4faf8;">'
                    . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;white-space:nowrap;">' . $h($row['time']) . '</td>'
                    . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;color:#007865;font-weight:600;">wolny</td>'
                    . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;color:#6b7280;">—</td>'
                    . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;color:#6b7280;">—</td>'
                    . '</tr>';
                continue;
            }

            $cells = visit_report_booking_list_html($row['bookings']);
            $html .= '<tr>'
                . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;white-space:nowrap;vertical-align:top;">' . $h($row['time']) . '</td>'
                . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;color:#a04a3a;font-weight:600;vertical-align:top;">zajęty</td>'
                . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;vertical-align:top;">' . $cells['visit'] . '</td>'
                . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;vertical-align:top;">' . $cells['patient'] . '</td>'
                . '</tr>';
        }

        $html .= '</tbody></table></div>';
    }

    if ($day['extra'] !== []) {
        $html .= '<p style="margin:16px 0 8px;font-size:14px;font-weight:500;">Zapisane poza siatką godzin</p>';
        $html .= '<div style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
        $html .= '<table style="width:100%;min-width:640px;border-collapse:collapse;font-size:14px;">';
        $html .= '<thead><tr>';
        foreach (['Godzina', 'Status', 'Wizyta', 'Pacjent i kontakt'] as $heading) {
            $html .= '<th style="text-align:left;padding:10px;background:#14332c;color:#fff;font-weight:500;white-space:nowrap;">' . $heading . '</th>';
        }
        $html .= '</tr></thead><tbody>';
        foreach ($day['extra'] as $booking) {
            $cells = visit_report_booking_list_html([$booking]);
            $html .= '<tr>'
                . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;white-space:nowrap;vertical-align:top;">' . $h($booking['time']) . '</td>'
                . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;vertical-align:top;">' . $h($booking['status']) . '</td>'
                . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;vertical-align:top;">' . $cells['visit'] . '</td>'
                . '<td style="padding:10px;border-bottom:1px solid #e4e2dc;vertical-align:top;">' . $cells['patient'] . '</td>'
                . '</tr>';
        }
        $html .= '</tbody></table></div>';
    }

    return $html;
}

function visit_report_send_for_dates(PDO $pdo, array $dates, bool $test): array
{
    global $config;

    $days = [];
    foreach ($dates as $date) {
        $date = (string) $date;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            continue;
        }
        $days[] = visit_report_day($pdo, $date);
    }

    if ($days === []) {
        return ['ok' => false, 'reason' => 'no_dates', 'recipients' => [], 'summary' => []];
    }

    $from = (string) ($config['mail_from'] ?? 'noreply@marcin-romanowski.pl');
    $replyTo = (string) ($config['mail_reply_to'] ?? 'kontakt@marcin-romanowski.pl');
    $firstLabel = $days[0]['label'];
    $subject = $test ? 'Próbny raport wizyt — ' . $firstLabel : 'Raport wizyt — ' . $firstLabel;

    $plain = $test
        ? "To jest próbny raport. Od jutra taki mail przyjdzie codziennie o 06:00 i będzie dotyczył danego dnia.\n\n"
        : "Poranny raport wizyt.\n\n";
    foreach ($days as $day) {
        $plain .= visit_report_plain_day($day);
    }

    $htmlIntro = $test
        ? '<p style="margin:0 0 10px;font-size:15px;">To jest <strong>próbny raport</strong>. Od jutra taki mail przyjdzie codziennie o 06:00 i będzie dotyczył danego dnia.</p>'
        : '<p style="margin:0 0 10px;font-size:15px;">Poranny raport wizyt.</p>';

    $html = '<html><body style="margin:0;padding:20px;background:#f4f3ef;font-family:Arial,sans-serif;color:#1c1c1c;">'
        . '<div style="max-width:760px;margin:0 auto;background:#fff;padding:20px;border:1px solid #e4e2dc;border-radius:12px;">'
        . '<p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#007865;">Marcin Romanowski</p>'
        . '<h1 style="margin:0 0 16px;font-size:22px;font-weight:500;">' . visit_report_h($test ? 'Próbny raport wizyt' : 'Raport wizyt') . '</h1>'
        . $htmlIntro;
    foreach ($days as $day) {
        $html .= visit_report_html_day($day);
    }
    $html .= '</div></body></html>';

    $boundary = 'rez' . bin2hex(random_bytes(12));
    $headers = 'From: ' . $from . "\r\n";
    if (filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers .= 'Reply-To: ' . $replyTo . "\r\n";
    }
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= 'Content-Type: multipart/alternative; boundary="' . $boundary . "\"\r\n";

    $body = "--{$boundary}\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($plain));
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($html));
    $body .= "--{$boundary}--\r\n";

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $results = [];
    $ok = true;
    foreach (visit_report_recipients() as $email) {
        $sent = @mail($email, $encodedSubject, $body, $headers);
        $results[$email] = $sent;
        if (!$sent) {
            $ok = false;
        }
    }

    $summary = [];
    foreach ($days as $day) {
        $summary[] = [
            'date' => $day['date'],
            'slot_count' => $day['slot_count'],
            'free_count' => $day['free_count'],
            'taken_count' => $day['taken_count'],
            'extra_count' => count($day['extra']),
        ];
    }

    return [
        'ok' => $ok && $results !== [],
        'recipients' => $results,
        'summary' => $summary,
    ];
}

function visit_report_render_cancel_page(string $title, string $message, ?array $booking = null, bool $showForm = false, string $token = '', string $signature = ''): void
{
    $h = 'visit_report_h';
    $bookingSummary = '';
    if ($booking) {
        $bookingSummary = '<p style="margin:10px 0 0;color:#3d4a46;font-size:14px;">'
            . '<strong>Wizyta:</strong> ' . $h((string) ($booking['booking_date'] ?? ''))
            . ' ' . $h(hm((string) ($booking['start_time'] ?? '')))
            . ' · ' . $h((string) ($booking['patient_name'] ?? ''))
            . '</p>';
    }

    $form = '';
    if ($showForm) {
        $form = '<form method="post" action="' . $h(visit_report_public_base_url() . '/rezerwacja/api/visit-report/cancel') . '" style="margin-top:18px;">'
            . '<input type="hidden" name="token" value="' . $h($token) . '">'
            . '<input type="hidden" name="sig" value="' . $h($signature) . '">'
            . '<label style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;margin-bottom:6px;">Hasło odwołania</label>'
            . '<input type="password" name="password" required style="width:100%;max-width:280px;height:40px;padding:0 12px;border:1px solid #d6d3cc;border-radius:8px;">'
            . '<p style="margin:8px 0 12px;font-size:12px;color:#6b7280;">Wpisz hasło: <strong>12345</strong></p>'
            . '<button type="submit" style="height:40px;padding:0 14px;border:1px solid #a04a3a;border-radius:8px;background:#fff5f2;color:#a04a3a;font-weight:600;cursor:pointer;">Odwołaj wizytę</button>'
            . '</form>';
    }

    http_response_code(200);
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!doctype html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . $h($title) . '</title></head><body style="margin:0;padding:22px;background:#f4f3ef;font-family:Arial,sans-serif;color:#1f2937;">'
        . '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e2dc;border-radius:12px;padding:20px;">'
        . '<p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#007865;">Marcin Romanowski</p>'
        . '<h1 style="margin:0 0 10px;font-size:22px;font-weight:500;color:#14332c;">' . $h($title) . '</h1>'
        . '<p style="margin:0;font-size:15px;line-height:1.5;">' . $h($message) . '</p>'
        . $bookingSummary
        . $form
        . '<p style="margin:18px 0 0;font-size:13px;"><a href="' . $h(public_app_url('admin')) . '" style="color:#007865;text-decoration:underline;">Otwórz panel wizyt</a></p>'
        . '</div></body></html>';
    exit;
}

function visit_report_handle_cancel_route(PDO $pdo, string $method): void
{
    $source = $method === 'POST' ? $_POST : $_GET;
    $token = trim((string) ($source['token'] ?? ''));
    $signature = trim((string) ($source['sig'] ?? ''));

    if (!visit_report_signature_ok($token, $signature)) {
        visit_report_render_cancel_page('Nieprawidłowy link', 'Link odwołania jest nieprawidłowy albo wygasł.');
    }

    $booking = visit_report_fetch_booking_by_token($pdo, $token);
    if (!$booking) {
        visit_report_render_cancel_page('Brak wizyty', 'Nie znaleziono wizyty dla tego linku.');
    }

    if ($method === 'GET') {
        visit_report_render_cancel_page(
            'Odwołanie wizyty',
            'Aby odwołać wizytę, wpisz hasło odwołania.',
            $booking,
            true,
            $token,
            $signature,
        );
    }

    $password = trim((string) ($_POST['password'] ?? ''));
    if (!hash_equals(visit_report_cancel_password(), $password)) {
        visit_report_render_cancel_page(
            'Błędne hasło',
            'Hasło odwołania jest nieprawidłowe. Spróbuj ponownie.',
            $booking,
            true,
            $token,
            $signature,
        );
    }

    $stmt = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE management_token = ? AND status != 'cancelled'");
    $stmt->execute([$token]);
    $booking = visit_report_fetch_booking_by_token($pdo, $token);

    if (!$booking) {
        visit_report_render_cancel_page('Brak wizyty', 'Nie znaleziono wizyty dla tego linku.');
    }

    if ($stmt->rowCount() > 0) {
        visit_report_render_cancel_page('Wizyta odwołana', 'Wizyta została odwołana.', $booking, false);
    }

    visit_report_render_cancel_page('Wizyta już była odwołana', 'Ta wizyta ma już status anulowana.', $booking, false);
}

function visit_report_handle_route(string $route, string $method): bool
{
    if ($route === '/admin/reports/visit/send-test' && $method === 'POST') {
        require_admin();
        $pdo = db();
        $data = json_input();
        $dates = [];
        foreach ((array) ($data['dates'] ?? []) as $date) {
            $date = (string) $date;
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                $dates[] = $date;
            }
        }
        if ($dates === []) {
            $today = date('Y-m-d');
            $tomorrow = date('Y-m-d', strtotime($today . ' +1 day'));
            $dates = [$today, $tomorrow];
        }
        json_response(visit_report_send_for_dates($pdo, $dates, true));
    }

    if ($route === '/visit-report/cancel' && in_array($method, ['GET', 'POST'], true)) {
        $pdo = db();
        visit_report_handle_cancel_route($pdo, $method);
    }

    return false;
}

function visit_report_maybe_run_silent(): void
{
    $today = date('Y-m-d');
    if ($today < visit_report_start_date()) {
        return;
    }
    if ((int) date('G') < visit_report_hour()) {
        return;
    }

    $state = visit_report_read_state();
    if (($state['last_date'] ?? '') === $today && !empty($state['ok'])) {
        return;
    }

    try {
        $pdo = db();
    } catch (Throwable $e) {
        return;
    }

    $lock = $pdo->prepare('SELECT GET_LOCK(?, 1)');
    $lock->execute(['rez_visit_report']);
    if ((int) $lock->fetchColumn() !== 1) {
        return;
    }

    try {
        $state = visit_report_read_state();
        if (($state['last_date'] ?? '') === $today && !empty($state['ok'])) {
            return;
        }
        $result = visit_report_send_for_dates($pdo, [$today], false);
        visit_report_write_state([
            'last_date' => $today,
            'ok' => $result['ok'],
            'sent_at' => date(DATE_ATOM),
        ]);
    } catch (Throwable $e) {
        // raport nie może blokować API
    } finally {
        $release = $pdo->prepare('SELECT RELEASE_LOCK(?)');
        $release->execute(['rez_visit_report']);
    }
}
