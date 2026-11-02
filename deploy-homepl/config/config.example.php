<?php
// Skopiuj ten plik jako config.php do folderu rezerwacja/config/ na serwerze.

$config = [
    'db_host' => 'localhost',
    'db_name' => 'nazwa_bazy',
    'db_user' => 'uzytkownik_bazy',
    'db_pass' => 'haslo_bazy',
    'db_charset' => 'utf8mb4',

    'admin_password' => '',
    'analytics_excluded_ips' => [
        // np. '203.0.113.10',
    ],

    // false: strona działa, pacjenci nie widzą terminów i nie mogą rezerwować.
    'schedule_enabled' => true,

    'app_base_path' => '/',
    'public_base_url' => 'https://marcin-romanowski.pl',
    'office_name' => 'Marcin Romanowski',
    'office_address' => 'ul. Turniowa 7/49, 20-563 Lublin',
    'mail_from' => 'noreply@marcin-romanowski.pl',
    'mail_reply_to' => 'kontakt@marcin-romanowski.pl',
    'owner_notification_email' => '',
    'visit_report_emails' => [
        'marcin.romanowski.lublin@gmail.com',
        'zalef87@gmail.com',
    ],
    'visit_report_hour' => 6,
    'visit_report_start_date' => '2026-11-01',
    'visit_report_cancel_password' => '12345',
    'visit_report_signing_key' => '',

    'gemini_api_key' => '',

    // Backup zapisów (bookings) co 6h.
    // Token wymagany tylko dla publicznego endpointu /rezerwacja/api/backups/bookings/run.
    'bookings_backup_token' => '',
    'bookings_backup_interval_seconds' => 21600,
    'bookings_backup_retention_days' => 30,
    'bookings_backup_dir' => dirname(__DIR__) . '/storage/bookings-backups',

    // WhatsApp Cloud API (Meta). Bez tokena nic nie wychodzi.
    'whatsapp_token' => '',
    'whatsapp_phone_number_id' => '',
    'whatsapp_owner_number' => '48663500636',
];
