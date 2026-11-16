<?php
declare(strict_types=1);

$config = [
    'whatsapp_encryption_key' => str_repeat('test-key-', 8),
    'whatsapp_retention_days' => 30,
];

require_once dirname(__DIR__) . '/api/whatsapp.php';

function assert_same($expected, $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $label . " failed\n");
        exit(1);
    }
}

[$ciphertext, $iv, $tag] = whatsapp_encrypt_body('Poufna wiadomość ąę');
assert_same('Poufna wiadomość ąę', whatsapp_decrypt_body($ciphertext, $iv, $tag), 'encryption');
assert_same(
    whatsapp_lookup_hash('wa-id', '48500100200'),
    whatsapp_lookup_hash('wa-id', '48500100200'),
    'lookup-hash-stable'
);
if (whatsapp_lookup_hash('wa-id', '48500100200') === whatsapp_lookup_hash('wa-id', '48500100201')) {
    fwrite(STDERR, "lookup-hash-unique failed\n");
    exit(1);
}
assert_same('recepta', whatsapp_issue_category('Proszę o receptę'), 'category-recepta');
assert_same('termin', whatsapp_issue_category('Czy mogę przełożyć termin?'), 'category-termin');
assert_same('dokumenty', whatsapp_issue_category('Potrzebuję zaświadczenia'), 'category-dokumenty');

$payload = [
    'entry' => [[
        'changes' => [[
            'value' => [
                'contacts' => [[
                    'wa_id' => '48500100200',
                    'profile' => ['name' => 'Jan Testowy'],
                ]],
                'messages' => [[
                    'id' => 'wamid.test',
                    'from' => '48500100200',
                    'timestamp' => '1793880000',
                    'type' => 'text',
                    'text' => ['body' => 'Dzień dobry'],
                ]],
            ],
        ]],
    ]],
];

$contacts = [];
$messages = [];
whatsapp_collect_contacts($payload, $contacts);
whatsapp_collect_messages($payload, $messages);
assert_same('Jan Testowy', $contacts['48500100200'] ?? null, 'contact-parser');
assert_same(1, count($messages), 'message-parser');
assert_same(false, $messages[0]['history'], 'live-message');

$historyPayload = ['history' => [['messages' => [['id' => 'wamid.old']]]]];
$historyMessages = [];
whatsapp_collect_messages($historyPayload, $historyMessages);
assert_same(true, $historyMessages[0]['history'], 'history-message');

echo "OK\n";
