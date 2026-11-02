<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$route = $api_route ?? api_route();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = db();

    if ($route === '/visit-types' && $method === 'GET') {
        $stmt = $pdo->query('SELECT * FROM visit_types WHERE active = 1');
        json_response(array_map('normalize_booking', $stmt->fetchAll()));
    }

    if ($route === '/admin/visit-types' && $method === 'GET') {
        require_admin();
        $stmt = $pdo->query('SELECT * FROM visit_types ORDER BY name');
        json_response(array_map('normalize_booking', $stmt->fetchAll()));
    }

    if ($route === '/admin/visit-types' && $method === 'POST') {
        require_admin();
        $data = json_input();
        $id = uniqid('vt_', true);
        $kind = (string) ($data['kind'] ?? 'followup');
        if (!in_array($kind, ['first', 'followup'], true)) {
            $kind = 'followup';
        }
        $stmt = $pdo->prepare(
            'INSERT INTO visit_types (id, name, description, duration_minutes, price, currency, payment_policy, active, kind)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $id,
            trim((string) ($data['name'] ?? 'Nowa wizyta')),
            (string) ($data['description'] ?? ''),
            (int) ($data['duration_minutes'] ?? 30),
            (float) ($data['price'] ?? 200),
            'PLN',
            $data['payment_policy'] ?? 'none',
            !empty($data['active']) ? 1 : 0,
            $kind,
        ]);
        $row = $pdo->prepare('SELECT * FROM visit_types WHERE id = ?');
        $row->execute([$id]);
        json_response(normalize_booking($row->fetch()));
    }

    if (preg_match('#^/admin/visit-types/([^/]+)$#', $route, $m) && $method === 'PUT') {
        require_admin();
        $data = json_input();
        $kind = (string) ($data['kind'] ?? 'followup');
        if (!in_array($kind, ['first', 'followup'], true)) {
            $kind = 'followup';
        }
        $stmt = $pdo->prepare(
            'UPDATE visit_types SET name = ?, description = ?, duration_minutes = ?, price = ?, payment_policy = ?, active = ?, kind = ? WHERE id = ?'
        );
        $stmt->execute([
            trim((string) ($data['name'] ?? '')),
            (string) ($data['description'] ?? ''),
            (int) ($data['duration_minutes'] ?? 30),
            (float) ($data['price'] ?? 0),
            $data['payment_policy'] ?? 'none',
            !empty($data['active']) ? 1 : 0,
            $kind,
            $m[1],
        ]);
        $row = $pdo->prepare('SELECT * FROM visit_types WHERE id = ?');
        $row->execute([$m[1]]);
        $found = $row->fetch();
        if (!$found) {
            json_response(['error' => 'Not found'], 404);
        }
        json_response(normalize_booking($found));
    }

    json_response(['error' => 'Not found'], 404);
} catch (PDOException $e) {
    json_response(['error' => 'Database error'], 500);
}
