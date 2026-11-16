<?php
declare(strict_types=1);

// Atrapa MyDr ext_api dla testu integracyjnego: php -S 127.0.0.1:8099 mydr_mock_server.php

$stateFile = getenv('MYDR_MOCK_STATE') ?: sys_get_temp_dir() . '/mydr_mock.json';
$state = is_file($stateFile) ? json_decode((string) file_get_contents($stateFile), true) : null;
if (!is_array($state)) {
    $state = [];
}
$state += [
    'access' => 'access-0',
    'refresh' => 'refresh-0',
    'next_id' => 1000,
    'patients' => [],
    'visits' => [],
    'calls' => [],
];

$method = $_SERVER['REQUEST_METHOD'];
$path = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = '/' . trim((string) preg_replace('#^/ext#', '', $path), '/') . '/';
$raw = (string) file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
    parse_str($raw, $body);
}
$state['calls'][] = $method . ' ' . $path;

$respond = static function (int $code, $data) use (&$state, $stateFile): void {
    file_put_contents($stateFile, json_encode($state, JSON_UNESCAPED_UNICODE));
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
};

if ($path === '/o/token/' && $method === 'POST') {
    if (($body['refresh_token'] ?? '') !== $state['refresh'] || ($body['client_id'] ?? '') !== 'cid') {
        $respond(400, ['error' => 'invalid_grant']);
    }
    $n = (int) substr((string) $state['refresh'], 8) + 1;
    $state['access'] = 'access-' . $n;
    $state['refresh'] = 'refresh-' . $n;
    $respond(200, ['access_token' => $state['access'], 'refresh_token' => $state['refresh'], 'expires_in' => 36000, 'scope' => 'external_api']);
}

$auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
if ($auth !== 'Bearer ' . $state['access']) {
    $respond(401, ['code' => 'not_authenticated']);
}

if ($path === '/self/') {
    $respond(200, ['id' => 21239]);
}

if ($path === '/patients/' && $method === 'GET') {
    $results = array_values(array_filter($state['patients'], static function (array $p): bool {
        foreach (['email', 'telephone', 'surname'] as $key) {
            if (isset($_GET[$key]) && (string) ($p[$key] ?? '') !== (string) $_GET[$key]) {
                return false;
            }
        }
        return true;
    }));
    $respond(200, ['count' => count($results), 'results' => $results]);
}

if ($path === '/patients/' && $method === 'POST') {
    $id = $state['next_id']++;
    $state['patients'][(string) $id] = ['id' => $id] + $body;
    $respond(201, $state['patients'][(string) $id]);
}

if (preg_match('#^/patients/(\d+)/visits/$#', $path, $m) && $method === 'GET') {
    $results = array_values(array_filter($state['visits'], static fn(array $v): bool =>
        (int) $v['patient'] === (int) $m[1]
        && (!isset($_GET['date_from']) || $v['date'] >= $_GET['date_from'])
        && (!isset($_GET['date_to']) || $v['date'] <= $_GET['date_to'])));
    $respond(200, ['count' => count($results), 'results' => $results]);
}

if ($path === '/visits/' && $method === 'POST') {
    foreach (['patient', 'doctor', 'office', 'date'] as $key) {
        if (empty($body[$key])) {
            $respond(400, ['detail' => 'missing ' . $key]);
        }
    }
    $id = $state['next_id']++;
    $state['visits'][(string) $id] = ['id' => $id] + $body;
    $respond(201, $state['visits'][(string) $id]);
}

if (preg_match('#^/visits/(\d+)/$#', $path, $m) && $method === 'PATCH') {
    if (!isset($state['visits'][$m[1]])) {
        $respond(404, ['detail' => 'not found']);
    }
    $state['visits'][$m[1]] = array_merge($state['visits'][$m[1]], $body);
    $state['last_patch'] = $body;
    $respond(200, $state['visits'][$m[1]]);
}

$respond(404, ['detail' => 'no route ' . $method . ' ' . $path]);
