<?php
declare(strict_types=1);

// Wymaga MySQL ze schema.sql, config/config.php wskazującego na atrapę
// (mydr_base_url = http://127.0.0.1:8099/ext, client_id = cid) i uruchomionego
// tests/mydr_mock_server.php. Uruchamiane w Dockerze, nie na produkcji.

require_once dirname(__DIR__) . '/api/bootstrap.php';
require_once dirname(__DIR__) . '/api/mydr.php';

$stateFile = getenv('MYDR_MOCK_STATE') ?: sys_get_temp_dir() . '/mydr_mock.json';

function assert_same($expected, $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $label . ' failed: expected ' . var_export($expected, true) . ', got ' . var_export($actual, true) . "\n");
        exit(1);
    }
}

function mock_state(): array
{
    global $stateFile;
    return json_decode((string) file_get_contents($stateFile), true);
}

function mock_write(array $state): void
{
    global $stateFile;
    file_put_contents($stateFile, json_encode($state, JSON_UNESCAPED_UNICODE));
}

function add_booking(PDO $pdo, string $id, string $name, string $email, string $phone, string $start, string $status = 'pending'): void
{
    $end = from_minutes(minutes($start) + 60);
    $pdo->prepare(
        "INSERT INTO bookings (id, visit_type_id, booking_date, start_time, end_time, patient_name, patient_email, patient_phone, status, payment_status, management_token)
         VALUES (?, 'vt_1', DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?, ?, ?, ?, ?, ?, 'unpaid', ?)"
    )->execute([$id, $start, $end, $name, $email, $phone, $status, bin2hex(random_bytes(16))]);
}

$pdo = db();
$pdo->exec('DELETE FROM mydr_booking_links');
$pdo->exec('DELETE FROM mydr_tokens');
$pdo->exec("DELETE FROM bookings WHERE id LIKE 't_%'");
mock_write([
    'access' => 'access-0',
    'refresh' => 'refresh-0',
    'next_id' => 1000,
    'patients' => [
        '500' => ['id' => 500, 'name' => 'Jan', 'surname' => 'Nowak', 'email' => 'jan@example.com', 'telephone' => '500100200'],
        '501' => ['id' => 501, 'name' => 'Ewa', 'surname' => 'Nowak', 'email' => 'rodzina@example.com', 'telephone' => '600'],
        '502' => ['id' => 502, 'name' => 'Ola', 'surname' => 'Nowak', 'email' => 'rodzina@example.com', 'telephone' => '601'],
        '503' => ['id' => 503, 'name' => 'Piotr', 'surname' => 'Lis', 'email' => '', 'telephone' => '700800900'],
    ],
    'visits' => [],
    'calls' => [],
]);

// Nowy pacjent: token odświeżony z config, karta i wizyta założone.
add_booking($pdo, 't_new', 'Anna Kowalska', 'anna@example.com', '+48 511 222 333', '15:00');
$result = mydr_sync_booking($pdo, 't_new');
assert_same('synced', $result['status'], 'new-synced');
$state = mock_state();
assert_same('refresh-1', $state['refresh'], 'token-rotated');
assert_same('refresh-1', (string) mydr_token_row($pdo)['refresh_token'], 'token-stored');
$patient = $state['patients'][(string) $result['patient_id']];
assert_same(['Anna', 'Kowalska', '511222333'], [$patient['name'], $patient['surname'], $patient['telephone']], 'new-patient-data');
$visit = $state['visits'][(string) $result['visit_id']];
assert_same([21239, 76376, 'Rezerwacja', '15:00:00', '16:00:00'], [$visit['doctor'], $visit['office'], $visit['state'], $visit['timeFrom'], $visit['timeTo']], 'new-visit-data');

// Ponowna synchronizacja bez zmian nie zakłada drugiej wizyty.
$visitsBefore = count($state['visits']);
mydr_sync_booking($pdo, 't_new');
assert_same($visitsBefore, count(mock_state()['visits']), 'idempotent');

// Istniejący pacjent po e-mailu i nazwisku.
add_booking($pdo, 't_known', 'Jan Nowak', 'jan@example.com', '999', '17:00');
$result = mydr_sync_booking($pdo, 't_known');
assert_same(500, $result['patient_id'] ?? null, 'known-by-email');

// Istniejący pacjent po telefonie (+48 i spacje), bez e-maila w MyDr.
add_booking($pdo, 't_phone', 'Piotr Lis', 'piotr@example.com', '+48 700 800 900', '18:00');
$result = mydr_sync_booking($pdo, 't_phone');
assert_same(503, $result['patient_id'] ?? null, 'known-by-phone');

// Ten sam e-mail rodzinny i nazwisko u dwóch osób: bez zgadywania.
$patientsBefore = count(mock_state()['patients']);
add_booking($pdo, 't_amb', 'Kasia Nowak', 'rodzina@example.com', '602', '19:00');
$result = mydr_sync_booking($pdo, 't_amb');
assert_same('needs_review', $result['status'], 'ambiguous-review');
assert_same($patientsBefore, count(mock_state()['patients']), 'ambiguous-no-new-patient');
assert_same('needs_review', (string) mydr_link($pdo, 't_amb')['sync_status'], 'ambiguous-link');

// Potwierdzenie i płatność: PATCH stanu bez nadpisywania notatki lekarza.
$pdo->exec("UPDATE bookings SET status = 'confirmed', payment_status = 'paid' WHERE id = 't_new'");
mydr_sync_booking($pdo, 't_new');
$state = mock_state();
assert_same('Zaplanowana i opłacona', $state['last_patch']['state'], 'paid-state');
assert_same(false, array_key_exists('note', $state['last_patch']), 'patch-without-note');

// Przełożenie.
$pdo->exec("UPDATE bookings SET start_time = '16:00', end_time = '17:00' WHERE id = 't_new'");
mydr_sync_booking($pdo, 't_new');
$visitId = (string) mydr_link($pdo, 't_new')['visit_id'];
assert_same('16:00:00', mock_state()['visits'][$visitId]['timeFrom'], 'rescheduled');

// Anulowanie.
$pdo->exec("UPDATE bookings SET status = 'cancelled' WHERE id = 't_new'");
mydr_sync_booking($pdo, 't_new');
assert_same('Anulowana', mock_state()['visits'][$visitId]['state'], 'cancelled');

// Wygasły access token: 401, odświeżenie i powtórzenie.
$state = mock_state();
$state['access'] = 'access-revoked';
mock_write($state);
$pdo->exec("UPDATE mydr_tokens SET access_expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR)");
$pdo->exec("UPDATE bookings SET status = 'confirmed' WHERE id = 't_known'");
$result = mydr_sync_booking($pdo, 't_known');
assert_same('synced', $result['status'], 'retry-after-401');

// Timeout po założeniu wizyty: ponowienie przejmuje istniejącą wizytę.
add_booking($pdo, 't_timeout', 'Jan Nowak', 'jan@example.com', '999', '20:00');
$date = (string) $pdo->query("SELECT booking_date FROM bookings WHERE id = 't_timeout'")->fetchColumn();
$state = mock_state();
$state['visits']['9000'] = ['id' => 9000, 'patient' => 500, 'doctor' => 21239, 'office' => 76376, 'date' => $date, 'timeFrom' => '20:00:00', 'timeTo' => '21:00:00', 'state' => 'Rezerwacja'];
mock_write($state);
mydr_save_link($pdo, 't_timeout', 500, null, 'error', 'timeout');
$visitsBefore = count($state['visits']);
$result = mydr_sync_booking($pdo, 't_timeout');
assert_same(9000, $result['visit_id'] ?? null, 'adopt-existing');
assert_same($visitsBefore, count(mock_state()['visits']), 'no-duplicate-after-timeout');

// Anulowana zanim trafiła do MyDr: nic nie jest zakładane.
add_booking($pdo, 't_skip', 'Zofia Mazur', 'zofia@example.com', '888', '21:00', 'cancelled');
assert_same('skipped', mydr_sync_booking($pdo, 't_skip')['status'], 'cancelled-before-sync');

// Synchronizacja po wysłaniu odpowiedzi (shutdown) w osobnym procesie.
add_booking($pdo, 't_deferred', 'Marek Zając', 'marek@example.com', '777', '22:00');
$script = escapeshellarg(dirname(__DIR__) . '/tests/mydr_deferred_child.php');
exec('php ' . $script . ' t_deferred', $output, $code);
assert_same(0, $code, 'deferred-exit');
assert_same('synced', (string) mydr_link($pdo, 't_deferred')['sync_status'], 'deferred-synced');

echo "OK\n";
