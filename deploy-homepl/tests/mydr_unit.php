<?php
declare(strict_types=1);

$config = ['mydr_evisit' => false];

if (!function_exists('hm')) {
    function hm(string $time): string
    {
        return substr($time, 0, 5);
    }
}

require_once dirname(__DIR__) . '/api/mydr.php';

function assert_same($expected, $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $label . ' failed: ' . var_export($actual, true) . "\n");
        exit(1);
    }
}

assert_same(['500100200', '+48500100200', '48500100200'], mydr_phone_variants('+48 500-100-200'), 'phone-pl-prefixed');
assert_same(['500100200', '+48500100200', '48500100200'], mydr_phone_variants('500 100 200'), 'phone-pl-plain');
assert_same(['4915112345678', '+4915112345678'], mydr_phone_variants('+49 151 12345678'), 'phone-foreign');
assert_same([], mydr_phone_variants(''), 'phone-empty');

assert_same(['first' => 'Anna Maria', 'last' => 'Kowalska'], mydr_split_name('  Anna  Maria Kowalska '), 'split-name');
assert_same(['first' => 'Anna', 'last' => ''], mydr_split_name('Anna'), 'split-single');

$candidates = [
    ['id' => 1, 'surname' => 'Kowalska'],
    ['id' => 2, 'surname' => 'Nowak'],
];
assert_same(['result' => 'found', 'id' => 1], mydr_pick_patient($candidates, 'KOWALSKA'), 'pick-found');
assert_same(['result' => 'none', 'id' => null], mydr_pick_patient($candidates, 'Wiśniewska'), 'pick-none');
assert_same(
    ['result' => 'ambiguous', 'id' => null],
    mydr_pick_patient([['id' => 3, 'surname' => 'Żak'], ['id' => 4, 'surname' => 'żak']], 'ŻAK'),
    'pick-ambiguous'
);
assert_same(['result' => 'none', 'id' => null], mydr_pick_patient([['id' => 5, 'surname' => '']], ''), 'pick-empty-surname');

assert_same('Rezerwacja', mydr_visit_state(['status' => 'pending']), 'state-pending');
assert_same('Rezerwacja', mydr_visit_state(['status' => 'pending_payment']), 'state-pending-payment');
assert_same('Zaplanowana', mydr_visit_state(['status' => 'confirmed', 'payment_status' => 'unpaid']), 'state-confirmed');
assert_same('Zaplanowana i opłacona', mydr_visit_state(['status' => 'confirmed', 'payment_status' => 'paid']), 'state-paid');
assert_same('Anulowana', mydr_visit_state(['status' => 'cancelled']), 'state-cancelled');
assert_same(null, mydr_visit_state(['status' => 'completed']), 'state-completed');

$booking = [
    'booking_date' => '2026-11-23',
    'start_time' => '15:00',
    'end_time' => '15:45',
    'status' => 'pending',
    'payment_status' => 'unpaid',
];
$update = mydr_visit_update_payload($booking);
assert_same('15:00:00', $update['timeFrom'], 'payload-time-from');
assert_same('15:45:00', $update['timeTo'], 'payload-time-to');
assert_same(false, array_key_exists('note', $update), 'update-keeps-doctor-note');
$create = mydr_visit_create_payload($booking, ['name' => 'Pierwsza konsultacja']);
assert_same('Prywatna', $create['visit_kind'], 'create-kind');
assert_same('Rezerwacja online marcin-romanowski.pl — Pierwsza konsultacja', $create['note'], 'create-note');

echo "OK\n";
