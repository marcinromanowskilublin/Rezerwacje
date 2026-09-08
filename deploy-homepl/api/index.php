<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Uproszczony router (np. /rezerwacja/api/visit-types -> visit-types.php)

$base_path = '/rezerwacja/api';
$route = str_replace($base_path, '', $request_uri);

if ($route === '/visit-types') {
    require 'visit-types.php';
} else if (strpos($route, '/bookings') === 0) {
    require 'bookings.php';
} else if (strpos($route, '/availability') === 0) {
    require 'availability.php';
} else {
    http_response_code(404);
    echo json_encode(["error" => "Not found"]);
}
