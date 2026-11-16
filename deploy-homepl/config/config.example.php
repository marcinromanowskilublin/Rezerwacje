<?php
// Skopiuj ten plik jako config.php do folderu rezerwacja/config/ na serwerze.

$config = [
    'db_host' => 'localhost',
    'db_name' => 'nazwa_bazy',
    'db_user' => 'uzytkownik_bazy',
    'db_pass' => 'haslo_bazy',
    'db_charset' => 'utf8mb4',

    'admin_login' => 'admin',
    // Może być zwykłym hasłem albo wynikiem password_hash().
    'admin_password' => '',
    'admin_session_cookie' => 'mr_admin_session',
    'admin_session_idle_seconds' => 3600,
    // Puste = prywatny katalog systemowy poza publicznym katalogiem strony.
    'admin_session_dir' => '',
    'admin_session_secure' => true,
    'admin_login_rate_limit' => 10,
    'admin_login_rate_window_seconds' => 900,
    'cors_allowed_origins' => [
        'https://marcin-romanowski.pl',
    ],
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
    'contact_form_email' => '',
    'visit_report_emails' => [
        'lekarz@example.com',
    ],
    'visit_report_hour' => 6,
    'visit_report_start_date' => '2026-11-01',
    'visit_report_cancel_password' => '',
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
    'whatsapp_business_account_id' => '',
    // Numer nadawcy zarejestrowany w Cloud API. Musi być inny niż numer używany
    // w aplikacji WhatsApp, inaczej kierunek wiadomości w wątku jest nierozpoznawalny.
    'whatsapp_business_number' => '',
    // Numer właściciela, na który trafiają powiadomienia o rezerwacjach.
    'whatsapp_owner_number' => '48663500636',
    'whatsapp_app_secret' => '',
    'whatsapp_webhook_verify_token' => '',
    // Długi losowy sekret (min. 32 znaki) do szyfrowania treści w bazie.
    'whatsapp_encryption_key' => '',
    'whatsapp_graph_version' => 'v21.0',
    'whatsapp_retention_days' => 30,
    'whatsapp_cleanup_token' => '',
    'whatsapp_cleanup_interval_seconds' => 21600,
    'whatsapp_webhook_rate_limit' => 1800,
    'whatsapp_webhook_rate_window_seconds' => 60,
    'whatsapp_webhook_max_bytes' => 8388608,
    'whatsapp_bot_enabled' => false,
    'whatsapp_bot_delay_minutes' => 120,
    'whatsapp_bot_run_token' => '',
    'whatsapp_bot_first_reply' => 'Dzień dobry, odczytałem wiadomość. Zbiorę potrzebne informacje i przekażę sprawę do odpowiedzi.',
    'whatsapp_bot_menu_text' => "Wybierz numer sprawy:\n1. Odwołanie wizyty\n2. Przełożenie terminu\n3. Recepta/leki\n4. Dokumenty/zaświadczenie\n5. Płatność\n6. Inna sprawa",

    // SMSAPI. Wysyłka działa wyłącznie po ustawieniu tokena.
    'smsapi_token' => '',
    'smsapi_sender' => '', // opcjonalna, wcześniej zweryfikowana nazwa nadawcy
    'smsapi_callback_token' => '', // długi losowy sekret używany jako parametr ?key=... callbacku
    'smsapi_reminder_token' => '', // długi losowy sekret do /api/smsapi/reminders/run
    'smsapi_auto' => [
        'booking_created' => false,
        'booking_cancelled' => false,
        'booking_rescheduled' => false,
        'reminder_day_before' => false,
    ],
    'smsapi_templates' => [
        'booking_created' => [
            'label' => 'Potwierdzenie rezerwacji',
            'message' => 'Dzień dobry {first_name}, termin wizyty u {office_name}: {date} o {time}. Zarządzanie wizytą: {manage_url}',
        ],
        'reminder_day_before' => [
            'label' => 'Przypomnienie dzień przed',
            'message' => 'Przypomnienie: jutro {date} o {time} jest wizyta u {office_name}. Jeśli nie możesz uczestniczyć, odwołaj termin: {manage_url}',
        ],
        'booking_cancelled' => [
            'label' => 'Anulowanie wizyty',
            'message' => 'Dzień dobry {first_name}, wizyta {date} o {time} została anulowana.',
        ],
        'booking_rescheduled' => [
            'label' => 'Zmiana terminu',
            'message' => 'Dzień dobry {first_name}, termin wizyty został zmieniony na {date} o {time}.',
        ],
    ],
    'smsapi_callback_ips' => [
        '89.174.81.98',
        '91.185.187.219',
        '213.189.53.211',
        '31.186.83.18',
        '212.91.26.253',
    ],

    // EDR / MyDR. Nie wpisuj tokenów do repozytorium; ustaw je wyłącznie w config.php na serwerze.
    'edr_enabled' => false,
    'edr_base_url' => 'https://edm.mydr.pl',
    'edr_client_id' => '',
    'edr_client_secret' => '',
    'edr_access_token' => '',
    'edr_refresh_token' => '',
    // Bezwzględna ścieżka poza katalogiem publicznym. MyDr rotuje Refresh Token.
    'edr_token_file' => '',
    'edr_doctor_id' => '',
    'edr_office_id' => '',
    'edr_default_visit_kind' => 'Prywatna',
    'edr_default_visit_state' => 'Zaplanowana',
    'edr_default_evisit' => true,
    // true: przy nowej rezerwacji zakłada lokalny status EDR; faktyczne utworzenie wizyty wymaga patient_id.
    'edr_auto_sync_bookings' => false,
    'edr_default_patient_id' => '',
    // Do czasu potwierdzenia endpointu aktualizacji dokumentacji EDR transkrypcje zostają w lokalnej kolejce.
    'edr_spoken_note_sync_enabled' => false,
    'edr_booking_note_prefix' => 'Rezerwacja z panelu marcin-romanowski.pl',
    // Transkrypcja: region UE i zerowa retencja są wymuszane przez endpoint.
    'deepgram_api_key' => '',
    'deepgram_base_url' => 'https://api.eu.deepgram.com',

    // MyDr EDM: każda rezerwacja ze strony zakłada wizytę w kalendarzu MyDr.
    // Dane aplikacji OAuth: MyDr → Ustawienia placówki → Dostęp do API.
    // Refresh token jest potrzebny tylko przy pierwszym uruchomieniu; potem
    // kolejne pary tokenów są trzymane w tabeli mydr_tokens.
    'mydr_enabled' => false,
    'mydr_base_url' => 'https://edm.mydr.pl/secure/ext_api',
    'mydr_client_id' => '',
    'mydr_client_secret' => '',
    'mydr_refresh_token' => '',
    'mydr_doctor_id' => 21239,
    'mydr_office_id' => 76376,
    'mydr_evisit' => false,
    // Rezerwacje utworzone przed tą datą nie są dosyłane automatycznie.
    'mydr_sync_since' => '2026-11-16',

    // Bramka płatnicza. Domyślnie wyłączona; nie wpisuj danych w repozytorium.
    // PayU: dane znajdziesz w panelu sprzedawcy w konfiguracji POS.
    'payment_gateway_enabled' => false,
    // false: nawet typy wizyt oznaczone jako "required" rezerwują się bez wymagania płatności.
    'payment_require_before_confirmation' => false,
    'payment_gateway_provider' => 'payu',
    'payment_gateway_environment' => 'production', // production albo sandbox
    'payment_time_limit_minutes' => 30,
    'payu_environment' => 'production', // production: secure.payu.com, sandbox: secure.snd.payu.com
    'payu_pos_id' => '',
    'payu_client_id' => '',
    'payu_client_secret' => '',
    'payu_second_key' => '', // Second key (MD5) do weryfikacji OpenPayu-Signature

    // Zostawione jako alternatywa, jeśli później wybierzesz Przelewy24.
    'przelewy24_environment' => 'production',
    'przelewy24_merchant_id' => 0,
    'przelewy24_pos_id' => 0,
    'przelewy24_api_key' => '',
    'przelewy24_crc' => '',
    'przelewy24_channel' => 16,
];
