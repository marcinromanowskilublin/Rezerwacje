<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/whatsapp.php';

$route = $api_route ?? api_route();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function fetch_booking_by_token(PDO $pdo, string $token): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE management_token = ?');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    return $row ? normalize_booking($row) : null;
}

function fetch_booking_by_id(PDO $pdo, string $id): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? normalize_booking($row) : null;
}

function send_booking_mail(array $booking): bool
{
    global $config;

    $email = (string) ($booking['patient_email'] ?? '');
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $manageUrl = public_app_url('manage/' . rawurlencode((string) $booking['management_token']));
    $office = trim((string) ($config['office_name'] ?? 'Marcin Romanowski'));
    $address = trim((string) ($config['office_address'] ?? ''));
    $from = (string) ($config['mail_from'] ?? 'noreply@localhost');
    $reply = (string) ($config['mail_reply_to'] ?? $from);
    $date = htmlspecialchars((string) $booking['booking_date'], ENT_QUOTES, 'UTF-8');
    $time = htmlspecialchars(hm((string) $booking['start_time']), ENT_QUOTES, 'UTF-8');
    $name = htmlspecialchars((string) $booking['patient_name'], ENT_QUOTES, 'UTF-8');
    $place = '<p><strong>Forma:</strong> konsultacja online</p>';
    if ($address !== '') {
        $place .= '<p><strong>Adres praktyki:</strong> ' . htmlspecialchars($address, ENT_QUOTES, 'UTF-8') . '</p>';
    }

    $subject = 'Konsultacja online zapisana — potwierdź albo anuluj';
    $headers = "From: {$from}\r\n";
    $headers .= "Reply-To: {$reply}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";

    $message = "
    <html>
    <body style='font-family: sans-serif; color: #111827; background: #FAFAFA; padding: 20px;'>
      <div style='max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; border: 1px solid #E5E7EB;'>
        <h2 style='font-weight: 400; font-size: 22px; margin-bottom: 16px;'>Wizyta zapisana</h2>
        <p>Witaj {$name},</p>
        <p>Termin konsultacji online u {$office} jest zarezerwowany. Potwierdź wizytę albo anuluj, jeśli nie możesz się połączyć.</p>
        <div style='margin: 20px 0; border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 15px 0;'>
          <p><strong>Data:</strong> {$date}</p>
          <p><strong>Godzina:</strong> {$time}</p>
          {$place}
        </div>
        <p style='margin-bottom: 20px;'>Otwórz link i wybierz jedną opcję:</p>
        <p>
          <a href='{$manageUrl}' style='display: inline-block; background: #111827; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; margin-right: 8px;'>Potwierdź wizytę</a>
          <a href='{$manageUrl}' style='display: inline-block; background: #fff; color: #111827; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; border: 1px solid #D1D5DB;'>Anuluj wizytę</a>
        </p>
        <p style='margin-top: 24px; font-size: 12px; color: #6B7280;'>Jeśli przyciski nie działają, wklej adres: {$manageUrl}</p>
      </div>
    </body>
    </html>
    ";

    return @mail($email, '=?UTF-8?B?' . base64_encode($subject) . '?=', $message, $headers);
}

function split_person_name(string $full): array
{
    $full = trim((string) preg_replace('/\s+/u', ' ', $full));
    if ($full === '') {
        return ['first' => '', 'last' => '', 'full' => ''];
    }
    if (function_exists('mb_strrpos')) {
        $pos = mb_strrpos($full, ' ');
        if ($pos === false) {
            return ['first' => $full, 'last' => '', 'full' => $full];
        }
        return [
            'first' => trim(mb_substr($full, 0, $pos)),
            'last' => trim(mb_substr($full, $pos + 1)),
            'full' => $full,
        ];
    }
    $pos = strrpos($full, ' ');
    if ($pos === false) {
        return ['first' => $full, 'last' => '', 'full' => $full];
    }
    return [
        'first' => trim(substr($full, 0, $pos)),
        'last' => trim(substr($full, $pos + 1)),
        'full' => $full,
    ];
}

function owner_booking_summary(array $booking): array
{
    $pdo = db();
    $visitType = visit_type($pdo, (string) ($booking['visit_type_id'] ?? ''), false);
    $kind = (string) ($visitType['kind'] ?? '');
    if ($kind === 'followup') {
        $kindLabel = 'kontrolna';
    } elseif ($kind === 'first') {
        $kindLabel = 'pierwsza konsultacja';
    } else {
        $kindLabel = 'konsultacja online';
    }

    $parts = split_person_name((string) ($booking['patient_name'] ?? ''));
    $name = $parts['full'] !== '' ? $parts['full'] : 'pacjent';

    return [
        'name' => $name,
        'first_name' => $parts['first'] !== '' ? $parts['first'] : $name,
        'last_name' => $parts['last'],
        'email' => trim((string) ($booking['patient_email'] ?? '')),
        'phone' => trim((string) ($booking['patient_phone'] ?? '')),
        'date' => (string) ($booking['booking_date'] ?? ''),
        'time' => hm((string) ($booking['start_time'] ?? '')),
        'end' => hm((string) ($booking['end_time'] ?? '')),
        'kind' => $kindLabel,
    ];
}

function owner_contact_or_dash(string $value): string
{
    $value = trim($value);
    return $value !== '' ? $value : '—';
}

function send_owner_notice_mail(string $title, string $subject, array $booking): bool
{
    global $config;

    $email = trim((string) ($config['owner_notification_email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $info = owner_booking_summary($booking);
    $from = (string) ($config['mail_from'] ?? 'noreply@localhost');
    $adminUrl = public_app_url('admin');
    $first = owner_contact_or_dash($info['first_name']);
    $last = owner_contact_or_dash($info['last_name']);
    $phone = owner_contact_or_dash($info['phone']);
    $patientEmail = owner_contact_or_dash($info['email']);
    $date = $info['date'];
    $time = $info['time'];
    $end = $info['end'];
    $kind = $info['kind'];
    $hours = $end !== '' ? "{$time}–{$end}" : $time;

    $plain = $title . "\n\n"
        . "Imię: {$first}\n"
        . "Nazwisko: {$last}\n"
        . "Telefon: {$phone}\n"
        . "E-mail: {$patientEmail}\n\n"
        . "Data: {$date}\n"
        . "Godzina: {$hours}\n"
        . "Rodzaj: {$kind}\n\n"
        . "Panel: {$adminUrl}\n";

    $h = static function (string $value): string {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    };

    $html = "
    <html>
    <body style='font-family: sans-serif; color: #111827; background: #FAFAFA; padding: 20px;'>
      <div style='max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; border: 1px solid #E5E7EB;'>
        <h2 style='font-weight: 400; font-size: 22px; margin-bottom: 16px;'>{$h($title)}</h2>
        <div style='margin: 0 0 20px; padding: 16px; background: #F3F4F6; border-radius: 10px; font-size: 16px; line-height: 1.6;'>
          <p style='margin: 0;'><strong>Imię:</strong> {$h($first)}</p>
          <p style='margin: 8px 0 0;'><strong>Nazwisko:</strong> {$h($last)}</p>
          <p style='margin: 8px 0 0;'><strong>Telefon:</strong> {$h($phone)}</p>
          <p style='margin: 8px 0 0;'><strong>E-mail:</strong> {$h($patientEmail)}</p>
        </div>
        <p><strong>{$h($info['name'])}</strong> · {$h($kind)}</p>
        <div style='margin: 20px 0; border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 15px 0;'>
          <p><strong>Data:</strong> {$h($date)}</p>
          <p><strong>Godzina:</strong> {$h($hours)}</p>
        </div>
        <p><a href='{$h($adminUrl)}' style='display: inline-block; background: #111827; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: bold;'>Otwórz panel wizyt</a></p>
      </div>
    </body>
    </html>
    ";

    $boundary = 'rez' . bin2hex(random_bytes(12));
    $headers = "From: {$from}\r\n";
    if (filter_var($info['email'], FILTER_VALIDATE_EMAIL)) {
        $headers .= 'Reply-To: ' . $info['email'] . "\r\n";
    }
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";

    $body = "--{$boundary}\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($plain));
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($html));
    $body .= "--{$boundary}--\r\n";

    return @mail($email, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
}

function send_owner_booking_mail(array $booking): bool
{
    $info = owner_booking_summary($booking);
    $subject = 'Nowa rezerwacja — ' . $info['name'] . ' — ' . $info['date'] . ' ' . $info['time'];
    return send_owner_notice_mail('Nowa rezerwacja', $subject, $booking);
}

function send_owner_cancel_mail(array $booking): bool
{
    $info = owner_booking_summary($booking);
    $subject = 'Wypis — ' . $info['name'] . ' — ' . $info['date'] . ' ' . $info['time'];
    return send_owner_notice_mail('Wypis z grafiku', $subject, $booking);
}

function notify_owner_cancel(array $booking): void
{
    send_owner_cancel_mail($booking);
    send_owner_cancel_whatsapp($booking);
}

function acquire_booking_date_lock(PDO $pdo, string $date): string
{
    $lockName = 'rez_booking_' . str_replace('-', '', $date);
    $stmt = $pdo->prepare('SELECT GET_LOCK(?, 5)');
    $stmt->execute([$lockName]);
    if ((int) $stmt->fetchColumn() !== 1) {
        json_response(['error' => 'Termin jest właśnie sprawdzany. Spróbuj ponownie.'], 503);
    }
    return $lockName;
}

function release_booking_date_lock(PDO $pdo, string $lockName): void
{
    $stmt = $pdo->prepare('SELECT RELEASE_LOCK(?)');
    $stmt->execute([$lockName]);
}

function slot_overlaps_ranges(int $start, int $end, array $ranges): bool
{
    foreach ($ranges as [$rangeStart, $rangeEnd]) {
        if (ranges_overlap($start, $end, (int) $rangeStart, (int) $rangeEnd)) {
            return true;
        }
    }
    return false;
}

function booking_grid_slots_for_visit(PDO $pdo, string $date, array $visitType): array
{
    $dayOfWeek = (int) date('w', strtotime($date . ' 12:00:00'));
    $rules = $pdo->prepare('SELECT * FROM availability_rules WHERE day_of_week = ? ORDER BY start_time ASC');
    $rules->execute([$dayOfWeek]);
    $duration = max(1, (int) ($visitType['duration_minutes'] ?? 30));

    $blockedStmt = $pdo->prepare('SELECT start_time, end_time FROM blocked_periods WHERE date = ?');
    $blockedStmt->execute([$date]);
    $blocked = [];
    foreach ($blockedStmt->fetchAll() as $row) {
        $blocked[] = [minutes((string) $row['start_time']), minutes((string) $row['end_time'])];
    }

    $found = [];
    foreach ($rules->fetchAll() as $rule) {
        $rule = normalize_booking($rule);
        if (!rule_matches_visit($rule, $visitType)) {
            continue;
        }
        $step = max(5, (int) ($rule['slot_duration'] ?? $duration));
        $start = minutes((string) $rule['start_time']);
        $end = minutes((string) $rule['end_time']);
        for ($cursor = $start; $cursor + $duration <= $end; $cursor += $step) {
            $slotEnd = $cursor + $duration;
            if (slot_overlaps_ranges($cursor, $slotEnd, $blocked)) {
                continue;
            }
            $found[from_minutes($cursor)] = true;
        }
    }

    $slots = array_keys($found);
    sort($slots);
    return $slots;
}

function realign_future_bookings(PDO $pdo, string $fromDate): array
{
    $stmt = $pdo->prepare(
        "SELECT * FROM bookings
         WHERE booking_date >= ? AND status != 'cancelled'
         ORDER BY booking_date ASC, start_time ASC, created_at ASC"
    );
    $stmt->execute([$fromDate]);
    $byDate = [];
    foreach ($stmt->fetchAll() as $row) {
        $booking = normalize_booking($row);
        $byDate[(string) $booking['booking_date']][] = $booking;
    }

    $moved = [];
    $checked = 0;
    foreach ($byDate as $date => $bookings) {
        $lockName = acquire_booking_date_lock($pdo, $date);
        try {
            $reservedRanges = [];
            $lastStart = -1;
            foreach ($bookings as $booking) {
                $checked++;
                $visitType = visit_type($pdo, (string) $booking['visit_type_id'], false);
                if (!$visitType) {
                    continue;
                }
                $duration = max(1, (int) $visitType['duration_minutes']);
                $slots = booking_grid_slots_for_visit($pdo, $date, $visitType);
                if ($slots === []) {
                    $currentStart = minutes((string) $booking['start_time']);
                    $reservedRanges[] = [$currentStart, $currentStart + $duration];
                    $lastStart = max($lastStart, $currentStart);
                    continue;
                }

                $candidates = [];
                foreach ($slots as $slot) {
                    $slotStart = minutes($slot);
                    $slotEnd = $slotStart + $duration;
                    if (slot_overlaps_ranges($slotStart, $slotEnd, $reservedRanges)) {
                        continue;
                    }
                    $candidates[] = [$slot, $slotStart, $slotEnd];
                }

                $current = hm((string) $booking['start_time']);
                $chosen = null;
                foreach ($candidates as $candidate) {
                    if ($candidate[0] === $current && $candidate[1] >= $lastStart) {
                        $chosen = $candidate;
                        break;
                    }
                }
                if ($chosen === null) {
                    foreach ($candidates as $candidate) {
                        if ($candidate[1] >= $lastStart) {
                            $chosen = $candidate;
                            break;
                        }
                    }
                }
                if ($chosen === null && $candidates !== []) {
                    $chosen = $candidates[0];
                }
                if ($chosen === null) {
                    $currentStart = minutes((string) $booking['start_time']);
                    $reservedRanges[] = [$currentStart, $currentStart + $duration];
                    $lastStart = max($lastStart, $currentStart);
                    continue;
                }

                $newStart = (string) $chosen[0];
                $newEnd = from_minutes((int) $chosen[2]);
                if ($newStart !== $current) {
                    $update = $pdo->prepare('UPDATE bookings SET start_time = ?, end_time = ? WHERE id = ?');
                    $update->execute([$newStart, $newEnd, $booking['id']]);
                    $moved[] = [
                        'id' => (string) $booking['id'],
                        'booking_date' => $date,
                        'from_time' => $current,
                        'to_time' => $newStart,
                        'patient_name' => (string) ($booking['patient_name'] ?? ''),
                    ];
                }

                $reservedRanges[] = [(int) $chosen[1], (int) $chosen[2]];
                $lastStart = max($lastStart, (int) $chosen[1]);
            }
        } finally {
            release_booking_date_lock($pdo, $lockName);
        }
    }

    return [
        'checked_count' => $checked,
        'moved_count' => count($moved),
        'moved' => $moved,
    ];
}

try {
    $pdo = db();

    if ($route === '/admin/login' && $method === 'POST') {
        require_admin();
        json_response(['ok' => true]);
    }

    if ($route === '/bookings' && $method === 'GET') {
        $token = (string) ($_GET['token'] ?? '');
        if ($token === '') {
            json_response(['error' => 'Brak tokenu'], 400);
        }
        $booking = fetch_booking_by_token($pdo, $token);
        if (!$booking) {
            json_response(['error' => 'Not found'], 404);
        }
        json_response($booking);
    }

    if ($route === '/bookings' && $method === 'DELETE') {
        $token = (string) ($_GET['token'] ?? '');
        if ($token === '') {
            json_response(['error' => 'Brak tokenu'], 400);
        }
        $stmt = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE management_token = ? AND status != 'cancelled'");
        $stmt->execute([$token]);
        $booking = fetch_booking_by_token($pdo, $token);
        if (!$booking) {
            json_response(['error' => 'Not found'], 404);
        }
        if ($stmt->rowCount() > 0) {
            notify_owner_cancel($booking);
        }
        json_response($booking);
    }

    if ($route === '/bookings/confirm' && $method === 'POST') {
        $data = json_input();
        $token = (string) ($data['token'] ?? $_GET['token'] ?? '');
        if ($token === '') {
            json_response(['error' => 'Brak tokenu'], 400);
        }
        $booking = fetch_booking_by_token($pdo, $token);
        if (!$booking) {
            json_response(['error' => 'Not found'], 404);
        }
        if ($booking['status'] === 'cancelled') {
            json_response(['error' => 'Nie można potwierdzić anulowanej wizyty'], 409);
        }
        $stmt = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE management_token = ? AND status != 'cancelled'");
        $stmt->execute([$token]);
        json_response(fetch_booking_by_token($pdo, $token));
    }

    if ($route === '/bookings' && $method === 'POST') {
        if (!schedule_enabled()) {
            json_response(['error' => 'Rezerwacja online jest wyłączona.'], 403);
        }
        $data = json_input();
        $visitTypeId = (string) ($data['visit_type_id'] ?? '');
        $date = (string) ($data['booking_date'] ?? '');
        $start = hm((string) ($data['start_time'] ?? ''));
        $name = trim((string) ($data['patient_name'] ?? ''));
        $email = trim((string) ($data['patient_email'] ?? ''));
        $phone = trim((string) ($data['patient_phone'] ?? ''));

        $visitType = visit_type($pdo, $visitTypeId);
        $validContactData = $name !== ''
            && strlen($name) <= 255
            && filter_var($email, FILTER_VALIDATE_EMAIL)
            && strlen($email) <= 255
            && $phone !== ''
            && strlen($phone) <= 50;
        if (
            !$visitType
            || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
            || !preg_match('/^\d{2}:\d{2}$/', $start)
            || !$validContactData
        ) {
            json_response(['error' => 'Niepełne dane rezerwacji'], 400);
        }

        $lockName = acquire_booking_date_lock($pdo, $date);
        $booking = null;
        $requestError = null;
        $requestErrorCode = 0;

        try {
            $available = available_slots($pdo, $date, $visitType);
            if (!in_array($start, $available, true)) {
                $requestError = 'Termin nie jest dostępny.';
                $requestErrorCode = 409;
            } else {
                $limit = $pdo->prepare(
                    "SELECT COUNT(*) AS cnt
                     FROM bookings
                     WHERE patient_email = ? AND status IN ('pending', 'confirmed')"
                );
                $limit->execute([$email]);
                $row = $limit->fetch();
                if ((int) $row['cnt'] >= 2) {
                    $requestError = 'Wykorzystano limit aktywnych rezerwacji dla tego adresu email.';
                    $requestErrorCode = 429;
                } else {
                    $id = uniqid('b_', true);
                    $token = bin2hex(random_bytes(16));
                    $end = from_minutes(minutes($start) + (int) $visitType['duration_minutes']);

                    $stmt = $pdo->prepare(
                        'INSERT INTO bookings (id, visit_type_id, booking_date, start_time, end_time, patient_name, patient_email, patient_phone, status, payment_status, management_token)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                    );
                    $stmt->execute([
                        $id,
                        $visitTypeId,
                        $date,
                        $start,
                        $end,
                        $name,
                        $email,
                        $phone,
                        'pending',
                        'unpaid',
                        $token,
                    ]);

                    $booking = fetch_booking_by_id($pdo, $id);
                }
            }
        } finally {
            release_booking_date_lock($pdo, $lockName);
        }

        if ($requestError !== null) {
            json_response(['error' => $requestError], $requestErrorCode);
        }
        if (!$booking) {
            json_response(['error' => 'Nie udało się zapisać terminu.'], 500);
        }

        $mailSent = send_booking_mail($booking);
        $ownerMailSent = send_owner_booking_mail($booking);
        $ownerWhatsappSent = send_owner_booking_whatsapp($booking);
        json_response($booking + [
            'mail_sent' => $mailSent,
            'owner_mail_sent' => $ownerMailSent,
            'owner_whatsapp_sent' => $ownerWhatsappSent,
        ]);
    }

    if ($route === '/admin/whatsapp/status' && $method === 'GET') {
        require_admin();
        json_response([
            'configured' => whatsapp_configured(),
            'owner_number_set' => trim((string) ($config['whatsapp_owner_number'] ?? '')) !== '',
        ]);
    }

    if ($route === '/admin/whatsapp/test' && $method === 'POST') {
        require_admin();
        if (!whatsapp_configured()) {
            json_response(['ok' => false, 'error' => 'Brak whatsapp_token albo whatsapp_phone_number_id w config.php'], 400);
        }
        $to = trim((string) ($config['whatsapp_owner_number'] ?? ''));
        if ($to === '') {
            json_response(['ok' => false, 'error' => 'Brak whatsapp_owner_number w config.php'], 400);
        }
        $sent = send_whatsapp_text($to, 'Test z rezerwacji: WhatsApp API działa.');
        json_response(['ok' => $sent, 'to' => whatsapp_digits($to)]);
    }

    if ($route === '/admin/bookings' && $method === 'GET') {
        require_admin();
        $date = (string) ($_GET['date'] ?? '');
        if ($date !== '') {
            $stmt = $pdo->prepare('SELECT * FROM bookings WHERE booking_date = ? ORDER BY start_time ASC');
            $stmt->execute([$date]);
        } else {
            $stmt = $pdo->query('SELECT * FROM bookings ORDER BY booking_date DESC, start_time ASC');
        }
        json_response(array_map('normalize_booking', $stmt->fetchAll()));
    }

    if ($route === '/admin/bookings' && $method === 'POST') {
        require_admin();
        $data = json_input();
        $visitTypeId = (string) ($data['visit_type_id'] ?? '');
        $date = (string) ($data['booking_date'] ?? '');
        $start = hm((string) ($data['start_time'] ?? ''));
        $name = trim((string) ($data['patient_name'] ?? ''));
        $email = trim((string) ($data['patient_email'] ?? ''));
        $phone = trim((string) ($data['patient_phone'] ?? ''));
        $status = (string) ($data['status'] ?? 'confirmed');
        $allowedStatus = ['pending', 'pending_payment', 'confirmed'];
        if (!in_array($status, $allowedStatus, true)) {
            $status = 'confirmed';
        }

        $visitType = visit_type($pdo, $visitTypeId, false);
        $validContactData = $name !== ''
            && strlen($name) <= 255
            && filter_var($email, FILTER_VALIDATE_EMAIL)
            && strlen($email) <= 255
            && $phone !== ''
            && strlen($phone) <= 50;
        if (
            !$visitType
            || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
            || !preg_match('/^\d{2}:\d{2}$/', $start)
            || !$validContactData
        ) {
            json_response(['error' => 'Niepełne dane rezerwacji'], 400);
        }

        $lockName = acquire_booking_date_lock($pdo, $date);
        $booking = null;
        $requestError = null;
        $requestErrorCode = 0;
        try {
            $occupied = occupied_ranges($pdo, $date);
            $duration = (int) $visitType['duration_minutes'];
            $slotStart = minutes($start);
            $slotEnd = $slotStart + max(1, $duration);
            foreach ($occupied as [$bStart, $bEnd]) {
                if (ranges_overlap($slotStart, $slotEnd, $bStart, $bEnd)) {
                    $requestError = 'Termin nachodzi na inną wizytę.';
                    $requestErrorCode = 409;
                    break;
                }
            }
            if ($requestError === null) {
                $id = uniqid('b_', true);
                $token = bin2hex(random_bytes(16));
                $end = from_minutes($slotEnd);
                $stmt = $pdo->prepare(
                    'INSERT INTO bookings (id, visit_type_id, booking_date, start_time, end_time, patient_name, patient_email, patient_phone, status, payment_status, management_token)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $stmt->execute([
                    $id,
                    $visitTypeId,
                    $date,
                    $start,
                    $end,
                    $name,
                    $email,
                    $phone,
                    $status,
                    'unpaid',
                    $token,
                ]);
                $booking = fetch_booking_by_id($pdo, $id);
            }
        } finally {
            release_booking_date_lock($pdo, $lockName);
        }
        if ($requestError !== null) {
            json_response(['error' => $requestError], $requestErrorCode);
        }
        if (!$booking) {
            json_response(['error' => 'Nie udało się zapisać terminu.'], 500);
        }
        json_response($booking);
    }

    if ($route === '/admin/bookings/realign' && $method === 'POST') {
        require_admin();
        $data = json_input();
        $fromDate = (string) ($data['from_date'] ?? date('Y-m-d'));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fromDate)) {
            $fromDate = date('Y-m-d');
        }
        json_response(realign_future_bookings($pdo, $fromDate));
    }

    if (preg_match('#^/admin/bookings/([^/]+)/cancel$#', $route, $m) && $method === 'POST') {
        require_admin();
        $before = fetch_booking_by_id($pdo, $m[1]);
        $stmt = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status != 'cancelled'");
        $stmt->execute([$m[1]]);
        $booking = fetch_booking_by_id($pdo, $m[1]);
        if (!$booking) {
            json_response(['error' => 'Not found'], 404);
        }
        if ($before && $before['status'] !== 'cancelled' && $stmt->rowCount() > 0) {
            notify_owner_cancel($booking);
        }
        json_response($booking);
    }

    if (preg_match('#^/admin/bookings/([^/]+)/reschedule$#', $route, $m) && $method === 'POST') {
        require_admin();
        $booking = fetch_booking_by_id($pdo, $m[1]);
        if (!$booking) {
            json_response(['error' => 'Not found'], 404);
        }
        $data = json_input();
        $date = (string) ($data['booking_date'] ?? '');
        $start = hm((string) ($data['start_time'] ?? ''));
        $visitType = visit_type($pdo, (string) $booking['visit_type_id'], false);
        if (!$visitType || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $start === '') {
            json_response(['error' => 'Nieprawidłowy nowy termin'], 400);
        }
        $lockName = acquire_booking_date_lock($pdo, $date);
        $requestError = null;
        try {
            $available = available_slots($pdo, $date, $visitType, $m[1]);
            if (!in_array($start, $available, true)) {
                $requestError = 'Nowy termin nie jest dostępny.';
            } else {
                $end = from_minutes(minutes($start) + (int) $visitType['duration_minutes']);
                $stmt = $pdo->prepare(
                    'UPDATE bookings SET booking_date = ?, start_time = ?, end_time = ? WHERE id = ?'
                );
                $stmt->execute([$date, $start, $end, $m[1]]);
            }
        } finally {
            release_booking_date_lock($pdo, $lockName);
        }
        if ($requestError !== null) {
            json_response(['error' => $requestError], 409);
        }
        json_response(fetch_booking_by_id($pdo, $m[1]));
    }

    if (preg_match('#^/admin/bookings/([^/]+)/status$#', $route, $m) && $method === 'PUT') {
        require_admin();
        $data = json_input();
        $status = (string) ($data['status'] ?? '');
        $allowed = ['pending', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show'];
        if (!in_array($status, $allowed, true)) {
            json_response(['error' => 'Nieprawidłowy status'], 400);
        }
        $before = fetch_booking_by_id($pdo, $m[1]);
        $stmt = $pdo->prepare('UPDATE bookings SET status = ? WHERE id = ?');
        $stmt->execute([$status, $m[1]]);
        $booking = fetch_booking_by_id($pdo, $m[1]);
        if (!$booking) {
            json_response(['error' => 'Not found'], 404);
        }
        if ($status === 'cancelled' && $before && $before['status'] !== 'cancelled') {
            notify_owner_cancel($booking);
        }
        json_response($booking);
    }

    json_response(['error' => 'Not found'], 404);
} catch (PDOException $e) {
    json_response(['error' => 'Database error'], 500);
}
