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

Ponowne wgranie samego `schema.sql` nie aktualizuje struktury istniejących tabel.

## 4. Konfiguracja Backend'u (PHP)
1. Backend pozostaje w folderze `/rezerwacja/api/`, niezależnie od frontendu działającego w domenie głównej.
2. Z katalogu `deploy-homepl/api` z Twojego lokalnego repozytorium wyślij pliki `.php` na FTP do katalogu `api`.
3. Skopiuj `deploy-homepl/config/config.example.php` do `rezerwacja/config/config.php` i uzupełnij bazę oraz `admin_password`.
   Jeśli chcesz wykluczyć własne wejścia z licznika odwiedzin, uzupełnij `analytics_excluded_ips` (np. Twój publiczny IP).
4. Wgraj też `deploy-homepl/api/.htaccess`, żeby adresy `/rezerwacja/api/visit-types` szły do `index.php`.

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
