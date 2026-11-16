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

    // EDR / MyDr EDM (https://edm.mydr.pl/secure/ext_api).
    // Sekrety wpisz wyłącznie na serwerze w config.php (nigdy w repozytorium).
    'edr_enabled' => false,
    'edr_base_url' => 'https://edm.mydr.pl/secure/ext_api',
    'edr_client_id' => '',
    'edr_client_secret' => '',
    'edr_access_token' => '',
    'edr_refresh_token' => '',
    'edr_doctor_id' => 21239,
    'edr_office_id' => 76376,
    'edr_auto_sync_bookings' => true,
    'edr_auto_create_patient' => true,
    'edr_spoken_note_sync_enabled' => true,
    'edr_default_visit_state' => 'Zaplanowana',
    'edr_default_visit_kind' => 'Prywatna',
    'edr_default_evisit' => true,
    'edr_booking_note_prefix' => 'Rezerwacja online marcin-romanowski.pl',

    // Transkrypcja wizyty mówionej (Deepgram API).
    'deepgram_api_key' => '',
    'deepgram_base_url' => 'https://api.eu.deepgram.com',
];
