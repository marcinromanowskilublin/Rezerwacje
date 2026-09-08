<?php
require_once '../config/config.php';

try {
    $pdo = new PDO("mysql:host=" . $config['db_host'] . ";dbname=" . $config['db_name'] . ";charset=" . $config['db_charset'], $config['db_user'], $config['db_pass']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->query("SELECT * FROM visit_types WHERE active = 1");
    $visitTypes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($visitTypes);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}
