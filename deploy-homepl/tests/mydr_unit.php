<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/api/mydr.php';

function assert_same($expected, $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $label . " failed\n");
        exit(1);
    }
}

$split = mydr_split_name('Anna Maria Kowalska');
assert_same('Anna Maria', $split['first'], 'split-first');
assert_same('Kowalska', $split['last'], 'split-last');
assert_same(['600100200', '+48600100200', '48600100200'], mydr_phone_variants('+48 600 100 200'), 'phone-variants');
assert_same(true, mydr_same_surname('Kowalska', ' kowalska '), 'surname-match');
assert_same(false, mydr_same_surname('Kowalska', 'Nowak'), 'surname-mismatch');

$found = mydr_pick_patient([
    ['id' => 7, 'surname' => 'Nowak'],
    ['id' => 9, 'surname' => 'Kowalska'],
], 'Kowalska');
assert_same('found', $found['result'], 'pick-found');
assert_same(9, $found['id'], 'pick-id');

$ambiguous = mydr_pick_patient([
    ['id' => 1, 'surname' => 'Kowalska'],
    ['id' => 2, 'surname' => 'kowalska'],
], 'Kowalska');
assert_same('ambiguous', $ambiguous['result'], 'pick-ambiguous');

$none = mydr_pick_patient([
    ['id' => 1, 'surname' => 'Nowak'],
], 'Kowalska');
assert_same('none', $none['result'], 'pick-none');

echo "OK\n";
