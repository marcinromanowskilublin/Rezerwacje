<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$route = $api_route ?? api_route();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = db();

    if ($route === '/availability/days' && $method === 'GET') {
        if (!schedule_enabled()) {
            json_response([]);
        }
        $visitTypeId = (string) ($_GET['visitTypeId'] ?? '');
        $month = (int) ($_GET['month'] ?? 0);
        $year = (int) ($_GET['year'] ?? 0);

        if ($visitTypeId === '' || $month < 1 || $month > 12 || $year < 2000) {
            json_response(['error' => 'Nieprawidłowe parametry'], 400);
        }

        $visitType = visit_type($pdo, $visitTypeId);
        if (!$visitType) {
            json_response(['error' => 'Nie znaleziono rodzaju wizyty'], 404);
        }

        $daysInMonth = (int) date('t', strtotime(sprintf('%04d-%02d-01', $year, $month)));
        $today = date('Y-m-d');
        $days = [];

        for ($day = 1; $day <= $daysInMonth; $day++) {
            $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
            if ($date < $today) {
                continue;
            }
            if (available_slots($pdo, $date, $visitType)) {
                $days[] = $date;
            }
        }

        json_response($days);
    }

    if ($route === '/availability/slots' && $method === 'GET') {
        if (!schedule_enabled()) {
            json_response([]);
        }
        $visitTypeId = (string) ($_GET['visitTypeId'] ?? '');
        $date = (string) ($_GET['date'] ?? '');

        if ($visitTypeId === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            json_response(['error' => 'Nieprawidłowe parametry'], 400);
        }

        $visitType = visit_type($pdo, $visitTypeId);
        if (!$visitType) {
            json_response(['error' => 'Nie znaleziono rodzaju wizyty'], 404);
        }

        $exclude = isset($_GET['excludeBookingId']) ? (string) $_GET['excludeBookingId'] : null;
        json_response(available_slots($pdo, $date, $visitType, $exclude));
    }

    if ($route === '/admin/availability/rules' && $method === 'GET') {
        require_admin();
        $stmt = $pdo->query('SELECT * FROM availability_rules ORDER BY day_of_week, start_time');
        json_response(array_map('normalize_booking', $stmt->fetchAll()));
    }

    if ($route === '/admin/availability/rules' && $method === 'POST') {
        require_admin();
        $data = json_input();
        $day = (int) ($data['day_of_week'] ?? -1);
        $start = hm((string) ($data['start_time'] ?? ''));
        $end = hm((string) ($data['end_time'] ?? ''));
        $slotDuration = max(5, (int) ($data['slot_duration'] ?? 60));
        $bufferMinutes = max(0, (int) ($data['buffer_minutes'] ?? 0));
        $audience = (string) ($data['audience'] ?? 'all');
        if (!in_array($audience, ['all', 'first', 'followup'], true) || $day < 0 || $day > 6 || $start === '' || $end === '') {
            json_response(['error' => 'Nieprawidłowe dane grafiku'], 400);
        }
        $id = uniqid('r_', true);
        $stmt = $pdo->prepare(
            'INSERT INTO availability_rules (id, day_of_week, start_time, end_time, slot_duration, buffer_minutes, audience)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $id,
            $day,
            $start,
            $end,
            $slotDuration,
            $bufferMinutes,
            $audience,
        ]);
        $row = $pdo->prepare('SELECT * FROM availability_rules WHERE id = ?');
        $row->execute([$id]);
        json_response(normalize_booking($row->fetch()));
    }

    if (preg_match('#^/admin/availability/rules/([^/]+)$#', $route, $m) && $method === 'PUT') {
        require_admin();
        $data = json_input();
        $day = (int) ($data['day_of_week'] ?? -1);
        $start = hm((string) ($data['start_time'] ?? ''));
        $end = hm((string) ($data['end_time'] ?? ''));
        $slotDuration = max(5, (int) ($data['slot_duration'] ?? 60));
        $bufferMinutes = max(0, (int) ($data['buffer_minutes'] ?? 0));
        $audience = (string) ($data['audience'] ?? 'all');
        if (!in_array($audience, ['all', 'first', 'followup'], true) || $day < 0 || $day > 6 || $start === '' || $end === '') {
            json_response(['error' => 'Nieprawidłowe dane grafiku'], 400);
        }
        $stmt = $pdo->prepare(
            'UPDATE availability_rules
             SET day_of_week = ?, start_time = ?, end_time = ?, slot_duration = ?, buffer_minutes = ?, audience = ?
             WHERE id = ?'
        );
        $stmt->execute([$day, $start, $end, $slotDuration, $bufferMinutes, $audience, $m[1]]);
        $row = $pdo->prepare('SELECT * FROM availability_rules WHERE id = ?');
        $row->execute([$m[1]]);
        $found = $row->fetch();
        if (!$found) {
            json_response(['error' => 'Not found'], 404);
        }
        json_response(normalize_booking($found));
    }

    if (preg_match('#^/admin/availability/rules/([^/]+)$#', $route, $m) && $method === 'DELETE') {
        require_admin();
        $stmt = $pdo->prepare('DELETE FROM availability_rules WHERE id = ?');
        $stmt->execute([$m[1]]);
        json_response(['ok' => true]);
    }

    if ($route === '/admin/availability/blocks' && $method === 'GET') {
        require_admin();
        $date = (string) ($_GET['date'] ?? '');
        if ($date !== '') {
            $stmt = $pdo->prepare('SELECT * FROM blocked_periods WHERE date = ? ORDER BY date ASC, start_time ASC');
            $stmt->execute([$date]);
        } else {
            $stmt = $pdo->query('SELECT * FROM blocked_periods ORDER BY date ASC, start_time ASC');
        }
        json_response(array_map('normalize_booking', $stmt->fetchAll()));
    }

    if ($route === '/admin/availability/blocks' && $method === 'POST') {
        require_admin();
        $data = json_input();
        $date = (string) ($data['date'] ?? '');
        $start = hm((string) ($data['start_time'] ?? ''));
        $end = hm((string) ($data['end_time'] ?? ''));

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $start === '' || $end === '') {
            json_response(['error' => 'Nieprawidłowe dane blokady'], 400);
        }

        $id = uniqid('bp_', true);
        $stmt = $pdo->prepare(
            'INSERT INTO blocked_periods (id, date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$id, $date, $start, $end, $data['reason'] ?? 'Ręczna blokada']);

        $row = $pdo->prepare('SELECT * FROM blocked_periods WHERE id = ?');
        $row->execute([$id]);
        json_response(normalize_booking($row->fetch()));
    }

    if (preg_match('#^/admin/availability/blocks/([^/]+)$#', $route, $m) && $method === 'DELETE') {
        require_admin();
        $stmt = $pdo->prepare('DELETE FROM blocked_periods WHERE id = ?');
        $stmt->execute([$m[1]]);
        json_response(['ok' => true]);
    }

    json_response(['error' => 'Not found'], 404);
} catch (PDOException $e) {
    json_response(['error' => 'Database error'], 500);
}
