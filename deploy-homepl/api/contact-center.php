<?php
declare(strict_types=1);

function contact_center_ensure_tables(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS phone_threads (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            phone varchar(50) NOT NULL,
            display_name varchar(255) NOT NULL,
            contact_confidence varchar(20) NOT NULL DEFAULT 'unknown',
            contact_source varchar(40) NOT NULL DEFAULT 'unknown',
            last_call_at datetime NOT NULL,
            last_message_at datetime DEFAULT NULL,
            missed_count int unsigned NOT NULL DEFAULT 1,
            last_status varchar(20) NOT NULL DEFAULT 'missed',
            summary varchar(500) NOT NULL DEFAULT '',
            messages_preview varchar(500) NOT NULL DEFAULT '',
            unread_count int unsigned NOT NULL DEFAULT 0,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_phone_threads_last_call (last_call_at),
            KEY idx_phone_threads_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS phone_messages (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            phone_thread_id bigint unsigned NOT NULL,
            direction varchar(20) NOT NULL DEFAULT 'inbound',
            message_type varchar(30) NOT NULL DEFAULT 'note',
            body_ciphertext longblob DEFAULT NULL,
            body_iv varbinary(12) DEFAULT NULL,
            body_tag varbinary(16) DEFAULT NULL,
            sent_at datetime NOT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_phone_messages_thread_time (phone_thread_id, sent_at, id),
            CONSTRAINT fk_phone_messages_thread
                FOREIGN KEY (phone_thread_id) REFERENCES phone_threads (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS contact_intents (
            id varchar(36) NOT NULL,
            channel varchar(20) NOT NULL DEFAULT 'manual',
            source_id varchar(80) DEFAULT NULL,
            contact_label varchar(255) NOT NULL,
            phone varchar(50) NOT NULL DEFAULT '',
            title varchar(255) NOT NULL,
            summary text NOT NULL,
            category varchar(60) NOT NULL DEFAULT 'inna',
            priority varchar(20) NOT NULL DEFAULT 'normal',
            status varchar(20) NOT NULL DEFAULT 'pending',
            extracted_at datetime NOT NULL,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_contact_intents_status_time (status, extracted_at),
            KEY idx_contact_intents_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function contact_center_iso(?string $value): ?string
{
    if ($value === null || trim($value) === '') {
        return null;
    }
    $date = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', trim($value), new DateTimeZone('Europe/Warsaw'));
    return $date instanceof DateTimeImmutable ? $date->format('c') : str_replace(' ', 'T', trim($value));
}

function contact_center_limit(): int
{
    return max(1, min(100, (int) ($_GET['limit'] ?? 50)));
}

function contact_center_thread_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'phone' => (string) $row['phone'],
        'display_name' => (string) $row['display_name'],
        'contact_confidence' => (string) $row['contact_confidence'],
        'contact_source' => (string) $row['contact_source'],
        'last_call_at' => contact_center_iso((string) $row['last_call_at']),
        'last_message_at' => contact_center_iso($row['last_message_at'] ?? null),
        'missed_count' => (int) $row['missed_count'],
        'last_status' => (string) $row['last_status'],
        'summary' => (string) $row['summary'],
        'messages_preview' => (string) $row['messages_preview'],
        'unread_count' => (int) $row['unread_count'],
    ];
}

function contact_center_message_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'direction' => (string) $row['direction'],
        'message_type' => (string) $row['message_type'],
        'body' => whatsapp_decrypt_body(
            $row['body_ciphertext'] ?? null,
            $row['body_iv'] ?? null,
            $row['body_tag'] ?? null
        ),
        'sent_at' => contact_center_iso((string) $row['sent_at']),
    ];
}

function contact_center_intent_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'channel' => (string) $row['channel'],
        'source_id' => $row['source_id'] !== null && $row['source_id'] !== '' ? (string) $row['source_id'] : null,
        'contact_label' => (string) $row['contact_label'],
        'phone' => (string) $row['phone'],
        'title' => (string) $row['title'],
        'summary' => (string) $row['summary'],
        'category' => (string) $row['category'],
        'priority' => (string) $row['priority'],
        'status' => (string) $row['status'],
        'extracted_at' => contact_center_iso((string) $row['extracted_at']),
        'updated_at' => contact_center_iso((string) $row['updated_at']),
    ];
}

function contact_center_value(array $data, string $key, string $fallback = ''): string
{
    $value = trim((string) ($data[$key] ?? $fallback));
    return preg_replace('/\s+/u', ' ', $value) ?? $value;
}

function contact_center_handle_route(string $route, string $method): bool
{
    if (strpos($route, '/admin/phone') !== 0 && strpos($route, '/admin/contact-intents') !== 0) {
        return false;
    }

    require_admin();
    $pdo = db();
    contact_center_ensure_tables($pdo);

    if ($route === '/admin/phone/threads' && $method === 'GET') {
        $limit = contact_center_limit();
        $stmt = $pdo->query(
            "SELECT * FROM phone_threads
             ORDER BY last_call_at DESC, id DESC
             LIMIT {$limit}"
        );
        json_response(array_map('contact_center_thread_row', $stmt->fetchAll()));
    }

    if (preg_match('#^/admin/phone/threads/(\d+)/messages$#', $route, $matches) && $method === 'GET') {
        $threadId = (int) $matches[1];
        $thread = $pdo->prepare('SELECT * FROM phone_threads WHERE id = ?');
        $thread->execute([$threadId]);
        $threadRow = $thread->fetch();
        if (!$threadRow) {
            json_response(['error' => 'Nie znaleziono wątku telefonu.'], 404);
        }
        $messages = $pdo->prepare(
            'SELECT * FROM phone_messages WHERE phone_thread_id = ? ORDER BY sent_at ASC, id ASC LIMIT 300'
        );
        $messages->execute([$threadId]);
        json_response([
            'thread' => contact_center_thread_row($threadRow),
            'messages' => array_map('contact_center_message_row', $messages->fetchAll()),
        ]);
    }

    if ($route === '/admin/contact-intents' && $method === 'GET') {
        $stmt = $pdo->query(
            "SELECT * FROM contact_intents
             ORDER BY FIELD(status, 'pending', 'done', 'dismissed'), extracted_at DESC"
        );
        json_response(array_map('contact_center_intent_row', $stmt->fetchAll()));
    }

    if ($route === '/admin/contact-intents' && $method === 'POST') {
        $data = json_input();
        $id = 'intent_' . bin2hex(random_bytes(8));
        $now = (new DateTimeImmutable('now', new DateTimeZone('Europe/Warsaw')))->format('Y-m-d H:i:s');
        $intent = [
            'channel' => contact_center_value($data, 'channel', 'manual'),
            'source_id' => contact_center_value($data, 'source_id'),
            'contact_label' => contact_center_value($data, 'contact_label', 'Ręczna intencja'),
            'phone' => contact_center_value($data, 'phone'),
            'title' => contact_center_value($data, 'title', 'Nowa sprawa'),
            'summary' => contact_center_value($data, 'summary'),
            'category' => contact_center_value($data, 'category', 'inna'),
            'priority' => contact_center_value($data, 'priority', 'normal'),
            'status' => contact_center_value($data, 'status', 'pending'),
        ];
        $stmt = $pdo->prepare(
            'INSERT INTO contact_intents
                (id, channel, source_id, contact_label, phone, title, summary, category, priority, status, extracted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $id,
            $intent['channel'],
            $intent['source_id'] !== '' ? $intent['source_id'] : null,
            $intent['contact_label'],
            $intent['phone'],
            $intent['title'],
            $intent['summary'],
            $intent['category'],
            $intent['priority'],
            $intent['status'],
            $now,
        ]);
        $found = $pdo->prepare('SELECT * FROM contact_intents WHERE id = ?');
        $found->execute([$id]);
        json_response(contact_center_intent_row($found->fetch()));
    }

    if (preg_match('#^/admin/contact-intents/([^/]+)$#', $route, $matches)) {
        $id = (string) $matches[1];
        if ($method === 'PUT') {
            $data = json_input();
            $allowed = ['channel', 'source_id', 'contact_label', 'phone', 'title', 'summary', 'category', 'priority', 'status'];
            $sets = [];
            $params = [];
            foreach ($allowed as $field) {
                if (array_key_exists($field, $data)) {
                    $sets[] = "{$field} = ?";
                    $value = contact_center_value($data, $field);
                    $params[] = $field === 'source_id' && $value === '' ? null : $value;
                }
            }
            if ($sets !== []) {
                $params[] = $id;
                $stmt = $pdo->prepare('UPDATE contact_intents SET ' . implode(', ', $sets) . ' WHERE id = ?');
                $stmt->execute($params);
            }
            $found = $pdo->prepare('SELECT * FROM contact_intents WHERE id = ?');
            $found->execute([$id]);
            $row = $found->fetch();
            if (!$row) {
                json_response(['error' => 'Nie znaleziono intencji.'], 404);
            }
            json_response(contact_center_intent_row($row));
        }
        if ($method === 'DELETE') {
            $stmt = $pdo->prepare('DELETE FROM contact_intents WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
        }
    }

    json_response(['error' => 'Not found'], 404);
}
