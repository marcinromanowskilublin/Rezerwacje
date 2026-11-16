# Instrukcja wdrożenia na hosting Home.pl (lub inny współdzielony PHP + MySQL)

## 1. Zbudowanie frontendu React
Zanim cokolwiek wyślesz na FTP serwera home.pl:
- Otwórz projekt lokalnie w programie np. Cursor, VSCode.
- Wypuść komendę: `npm install`
- Zbuduj kompilację produkcyjną frontendu: `npm run build`
- Zostanie utworzony nowy folder o nazwie `/dist`. To on stanowi gotową aplikację kliencką.

## 2. Przygotowanie Serwera i Plików 
1. Zaloguj się na serwer przez FTP lub SSH.
2. Z folderu `/dist` skopiuj WSZYSTKIE pliki do głównego katalogu domeny.
3. Plik `.htaccess` z kompilacji zapewnia obsługę tras aplikacji i przekierowanie starych adresów `/rezerwacja/...`.
4. Aplikacja kliencka wyświetla się bezpośrednio pod adresem `https://marcin-romanowski.pl/`.

## 3. Instalacja bazy danych (MySQL)
1. Zaloguj się do panelu home.pl.
2. Utwórz nową bazę danych MySQL. Zapisz: Nazwę Bazy, Nazwę Użytkownika, Hasło, oraz adres serwera hosta (np. localhost).
3. Wejdź w menedżer bazy danych (np. phpMyAdmin).
4. Dla nowej instalacji wgraj plik `deploy-homepl/database/schema.sql`.

### Aktualizacja istniejącej bazy
Przed migracją wykonaj kopię bazy. Następnie uruchom tylko brakujące migracje:
1. `deploy-homepl/database/migrate_grafik.sql` — pola grafiku, jeśli nie były wcześniej dodane.
2. `deploy-homepl/database/migrate_analytics.sql` — anonimowy licznik odsłon.
3. `deploy-homepl/database/migrate_hardening.sql` — usuwa nadmiarowe pole licznika i naprawia indeks rezerwacji, jeżeli starsza wersja już je utworzyła.
4. `deploy-homepl/database/migrate_smsapi.sql` — historia techniczna wysłanych SMS-ów i ich statusów doręczenia.
5. `deploy-homepl/database/migrate_whatsapp_threads.sql` — szyfrowany, 30-dniowy magazyn wątków WhatsApp.
6. Jeśli punkt 5 był wykonany przed pierwszym importem, uruchom jednorazowo `deploy-homepl/database/migrate_whatsapp_encrypted_metadata.sql`. Migracja zatrzyma się, gdy tabela zawiera już wiadomości.
7. `deploy-homepl/database/migrate_contact_center.sql` — karta telefonu/CDR, wiadomości telefoniczne i intencje do obsługi w panelu.
8. `deploy-homepl/database/migrate_mydr.sql` — tokeny MyDr i powiązania rezerwacji z wizytami w MyDr.

Ponowne wgranie samego `schema.sql` nie aktualizuje struktury istniejących tabel.

## 4. Konfiguracja Backend'u (PHP)
1. Backend pozostaje w folderze `/rezerwacja/api/`, niezależnie od frontendu działającego w domenie głównej.
2. Z katalogu `deploy-homepl/api` z Twojego lokalnego repozytorium wyślij pliki `.php` na FTP do katalogu `api`.
3. Skopiuj `deploy-homepl/config/config.example.php` do `rezerwacja/config/config.php` i uzupełnij bazę oraz `admin_password`.
   Jeśli chcesz wykluczyć własne wejścia z licznika odwiedzin, uzupełnij `analytics_excluded_ips` (np. Twój publiczny IP).
4. Wgraj też `deploy-homepl/api/.htaccess`, żeby adresy `/rezerwacja/api/visit-types` szły do `index.php`.

## MyDr EDM: wizyty zakładane automatycznie

Każda rezerwacja ze strony i z panelu trafia do kalendarza MyDr jako wizyta prywatna
lekarza Marcin Romanowski (`mydr_doctor_id` 21239, gabinet `mydr_office_id` 76376).
Potwierdzenie, opłacenie, przełożenie i anulowanie aktualizują tę samą wizytę.
Synchronizacja dzieje się po wysłaniu odpowiedzi do pacjenta, więc rezerwacja nie czeka na MyDr.

Pacjent jest szukany w MyDr po e-mailu, a potem po telefonie, i dopinany tylko przy zgodnym
nazwisku. Brak dopasowania zakłada nową kartę (imię, nazwisko, e-mail, telefon). Kilka pasujących
kart daje status `needs_review` i wizyta nie powstaje, dopóki nie wskażesz karty ręcznie.

1. Wgraj migrację `deploy-homepl/database/migrate_mydr.sql`.
2. W `config.php` ustaw `mydr_enabled => true`, `mydr_client_id`, `mydr_client_secret`
   i świeży `mydr_refresh_token` (MyDr → Ustawienia placówki → Dostęp do API → Wygeneruj).
   Po pierwszym odświeżeniu tokeny są rotowane i trzymane w tabeli `mydr_tokens`;
   stary refresh token z config.php przestaje działać i nie należy go używać nigdzie indziej.
3. Ustaw `mydr_sync_since` na dzień wdrożenia. Starsze rezerwacje nie są dosyłane automatycznie.
4. Sprawdź połączenie: `GET /api/admin/mydr/status` (zalogowany admin).
5. Ponowienie ręczne: `POST /api/admin/mydr/sync` z `{"booking_id": "..."}`; przy `needs_review`
   dodaj `"patient_id"` wybranej karty MyDr. Bez parametrów ponawia błędy z przyszłych terminów.
   Błędy są też ponawiane automatycznie co 15 minut przy ruchu na API.

Żeby zresetować tokeny, usuń wiersz z `mydr_tokens` i wpisz nowy refresh token do `config.php`.

## 5. Backup zapisów co 6 godzin
System zapisuje kopię tabeli `bookings` automatycznie (co 6h) przy normalnym ruchu API.

W `rezerwacja/config/config.php` ustaw:
```php
'bookings_backup_token' => 'USTAW_WLASNY_DLUGI_TOKEN',
'bookings_backup_interval_seconds' => 21600,
'bookings_backup_retention_days' => 30,
```

Przydatne endpointy:
- Status backupu (admin): `GET /rezerwacja/api/admin/backups/bookings/status`
- Wymuszenie backupu (admin lub token): `POST /rezerwacja/api/admin/backups/bookings/run`
- Wymuszenie backupu tokenem (np. cron): `GET /rezerwacja/api/backups/bookings/run?token=...`

## SMSAPI: wysyłka i callback statusów

Integracja SMSAPI jest domyślnie nieaktywna. Nie wysyła automatycznie SMS-ów przy rezerwacji. Aby ją uruchomić:
1. W `rezerwacja/config/config.php` ustaw `smsapi_token` na token API z SMSAPI. Opcjonalnie wpisz w `smsapi_sender` nazwę nadawcy wcześniej zatwierdzoną w SMSAPI.
2. Wygeneruj długi losowy sekret i wpisz go w `smsapi_callback_token`. Zachowaj go poza repozytorium i nie przesyłaj w wiadomości.
3. W panelu SMSAPI ustaw adres raportów doręczeń na `https://marcin-romanowski.pl/rezerwacja/api/smsapi/callback?key=TEN_SAM_SEKRET`. Serwer wymaga HTTPS, sekretu i adresu IP z oficjalnej listy callbacków SMSAPI.
4. Wgraj plik `deploy-homepl/database/migrate_smsapi.sql` do istniejącej bazy.
5. Jeśli chcesz uruchomić przypomnienia dzień przed wizytą, ustaw `smsapi_reminder_token`, włącz `smsapi_auto.reminder_day_before` i dodaj cron co 5-10 minut na `https://marcin-romanowski.pl/rezerwacja/api/smsapi/reminders/run?token=TWÓJ_TOKEN`.
6. Automatyczne SMS-y po rezerwacji, anulowaniu i przełożeniu są sterowane przez `smsapi_auto` i domyślnie pozostają wyłączone. Szablony można zmienić w `smsapi_templates`.

Endpointy:
- Wysyłka pojedynczego SMS-a (aktywna sesja admina i token CSRF): `POST /rezerwacja/api/admin/sms/send`, JSON `{"to":"+48500100200","message":"Treść wiadomości"}`.
- Szablony dla rezerwacji (admin): `GET /rezerwacja/api/admin/sms/templates?booking_id=ID`.
- Sprawdzenie konfiguracji (admin): `GET /rezerwacja/api/admin/sms/status`.
- Odczyt historii SMS-ów i statusów dla rezerwacji (admin): `GET /rezerwacja/api/admin/sms/messages?booking_id=ID`.
- Callback SMSAPI: `GET` lub `POST /rezerwacja/api/smsapi/callback?key=...`; aktualizuje status po ID SMSAPI lub parametrze `idx` i odpowiada `OK` po zapisaniu.
- Cron przypomnień: `GET` lub `POST /rezerwacja/api/smsapi/reminders/run?token=...`.

## PayU: bramka płatnicza

Integracja płatności jest domyślnie wyłączona. Kod nie przechowuje danych kart; zapisuje tylko techniczne metadane płatności i status rezerwacji.

1. Odzyskaj lub załóż konto sprzedawcy PayU. Do odzyskania zwykle potrzebny jest e-mail konta, NIP/REGON i dane firmy; jeśli konto było na innym adresie, użyj resetu hasła albo kontaktu z supportem PayU.
2. W panelu PayU odczytaj dane POS: `POS ID`, `OAuth client_id`, `OAuth client_secret` i `Second key (MD5)`.
3. W `rezerwacja/config/config.php` ustaw:
   - `payment_gateway_enabled` na `true`,
   - `payment_gateway_provider` na `payu`,
   - `payment_gateway_environment` i `payu_environment` na `production`,
   - `payu_pos_id`, `payu_client_id`, `payu_client_secret`, `payu_second_key`.
4. W PayU ustaw adres notyfikacji, jeśli panel tego wymaga: `https://marcin-romanowski.pl/rezerwacja/api/payments/payu/notify`.
5. Endpoint startu płatności: `POST /rezerwacja/api/payments/start` z tokenem rezerwacji. PayU odsyła pacjenta do panelu płatności, a po statusie `COMPLETED` system ustawia `payment_status = paid` i potwierdza wizytę.
6. Status konfiguracji w panelu admina: `GET /rezerwacja/api/admin/payments/status`.

W bazie zapisujemy identyfikator, cel, status oraz czasy wysyłki/doręczenia, bez treści SMS-a i bez numeru odbiorcy. Ręczna wysyłka w panelu ma ekran podglądu i edycji treści. Automaty działają tylko po włączeniu konkretnych reguł w konfiguracji.

## WhatsApp Business: karta wiadomości

1. Wgraj migrację `deploy-homepl/database/migrate_whatsapp_threads.sql`.
2. W Meta ustaw callback na `https://marcin-romanowski.pl/rezerwacja/api/whatsapp/webhook` i ten sam verify token co w konfiguracji serwera.
3. W `rezerwacja/config/config.php` uzupełnij: `whatsapp_token`, `whatsapp_phone_number_id`, `whatsapp_business_number`, `whatsapp_app_secret`, `whatsapp_webhook_verify_token` oraz losowy `whatsapp_encryption_key`.
4. Nadawcą jest osobny numer zarejestrowany w Cloud API, wpisany w `whatsapp_business_number`. Numer `48663500636` zostaje w aplikacji WhatsApp i służy wyłącznie jako `whatsapp_owner_number` do powiadomień. Oba pola nie mogą mieć tej samej wartości.
5. `whatsapp_token` musi pochodzić od System User w Meta Business, a nie z panelu testowego — token testowy wygasa po 24 godzinach.
6. Ustaw długi `whatsapp_cleanup_token` i wywołuj co najmniej raz dziennie `POST /rezerwacja/api/whatsapp/cleanup` z tokenem w nagłówku `X-Cleanup-Token`. Normalny ruch strony również uruchamia czyszczenie maksymalnie raz na 6 godzin.

Treść, numer WhatsApp, nazwy kontaktu, dopasowanie rezerwacji i kategoria sprawy są szyfrowane AES-256-GCM. Do wyszukania istniejącego wątku służy jednokierunkowy HMAC numeru. Wiadomości są automatycznie usuwane po 30 dniach. Panel wymaga bezpiecznej sesji admina, ogranicza liczbę prób logowania i nie zapisuje wiadomości w przeglądarce.

### Bot sekretarki WhatsApp

1. Wgraj migrację `deploy-homepl/database/migrate_whatsapp_bot.sql`.
2. W `rezerwacja/config/config.php` ustaw `whatsapp_bot_enabled` na `true`, wpisz długi losowy `whatsapp_bot_run_token` i zostaw `whatsapp_bot_delay_minutes` na `120` albo ustaw inną liczbę minut.
3. Ustaw cron w home.pl co 5-10 minut na `GET https://marcin-romanowski.pl/rezerwacja/api/whatsapp/bot/run?token=TWÓJ_TOKEN` albo wywołuj `POST` z nagłówkiem `X-Bot-Token`.
4. Bot wysyła pierwszą odpowiedź dopiero wtedy, gdy od ostatniej wiadomości pacjenta minie ustawiony czas i po tej wiadomości nie ma odpowiedzi z gabinetu. Najpierw analizuje ostatnią wiadomość przychodzącą: jeśli rozpozna sprawę, przechodzi od razu do zbierania danych; jeśli nie, pokazuje menu kategorii.
5. Dane zebrane przez bota, w tym PESEL i adres, są przechowywane w szyfrowanym JSON przy wątku WhatsApp. Bot dopisuje też kilka etykiet wątku, np. `termin`, `recepta/leki`, `dokumenty`, `PESEL`, `pilne`. Lista intencji w panelu dostaje tylko niesensytywne podsumowanie i odsyła do wątku.

Endpointy panelu:
- `GET /rezerwacja/api/admin/whatsapp/status`
- `GET /rezerwacja/api/admin/whatsapp/threads`
- `GET /rezerwacja/api/admin/whatsapp/threads/{id}/messages`
- `POST /rezerwacja/api/admin/whatsapp/threads/{id}/read`
- `POST /rezerwacja/api/admin/whatsapp/threads/{id}/bot/done`
- `POST /rezerwacja/api/admin/whatsapp/threads/{id}/reply`

## 6. Przełączenie aplikacji na tryb Produkcyjny
Zanim wykonasz `npm run build`, upewnij się że posiadasz odpowiedni wpis konfiguracyjny (np. w `.env`):
`VITE_API_MODE="production"`
`VITE_API_BASE_URL="/rezerwacja/api"`
Wtedy aplikacja po zbudowaniu będzie pytać pliki PHP.

## 7. Testy Pomyślnego Wdrożenia
1. Wejdź na `https://marcin-romanowski.pl/` i spróbuj przejść proces umawiania konsultacji.
2. Sprawdź tabelę `bookings` w swojej bazie phpMyAdmin czy wpis poprawnie się zarejestrował.
3. Wejdź na `https://marcin-romanowski.pl/admin` i zaloguj się hasłem z `admin_password`.

## 8. Konfiguracja Asystenta AI (Gemini) - Za darmo
System posiada wbudowanego inteligentnego asystenta do zarządzania kalendarzem głosem i tekstem, wspieranego przez najnowszy model Google Gemini.

1. Wejdź na stronę [Google AI Studio](https://aistudio.google.com/app/apikey) i zaloguj się swoim kontem Google.
2. Kliknij **Create API Key**. Jest to całkowicie bezpłatne (obsługuje darmowy próg 15 zapytań na minutę).
3. Skopiuj wygenerowany klucz.
4. W pliku `deploy-homepl/config/config.php` na serwerze Home.pl (lub lokalnie przed wysłaniem) podmień wartość:
```php
'gemini_api_key' => 'TWÓJ_WYGENEROWANY_KLUCZ_TUTAJ',
```
5. Asystent zacznie odpowiadać inteligentnie na polecenia.
