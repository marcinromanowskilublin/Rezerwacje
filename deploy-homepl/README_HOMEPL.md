# Instrukcja wdrożenia na hosting Home.pl (lub inny współdzielony PHP + MySQL)

## 1. Zbudowanie frontendu React
Zanim cokolwiek wyślesz na FTP serwera home.pl:
- Otwórz projekt lokalnie w programie np. Cursor, VSCode.
- Wypuść komendę: `npm install`
- Zbuduj kompilację produkcyjną frontendu: `npm run build`
- Zostanie utworzony nowy folder o nazwie `/dist`. To on stanowi gotową aplikację kliencką.

## 2. Przygotowanie Serwera i Plików 
1. Zaloguj się na serwer przez FTP lub SSH.
2. Na serwerze, w swoim głównym katalogu `public_html` (lub wybranej lokalizacji dla domeny), stwórz folder `rezerwacja`.
3. Z folderu `/dist` (utworzonego w kroku 1) skopiuj WSZYSTKIE pliki i umieść je na serwerze w folderze `rezerwacja/`.
4. Teraz aplikacja kliencka wyświetla się po wejściu na stronę `https://twoja-domena.pl/rezerwacja/`.

## 3. Instalacja bazy danych (MySQL)
1. Zaloguj się do panelu home.pl.
2. Utwórz nową bazę danych MySQL. Zapisz: Nazwę Bazy, Nazwę Użytkownika, Hasło, oraz adres serwera hosta (np. localhost).
3. Wejdź w menedżer bazy danych (np. phpMyAdmin).
4. Przejdź do zakładki "Importuj" i wgraj plik `deploy-homepl/database/schema.sql`.

## 4. Konfiguracja Backend'u (PHP)
1. Utwórz folder `api` obok (lub wewnątrz) zainstalowanego `/rezerwacja/`. Zalecany układ to `https://twoja-domena.pl/rezerwacja/api/`.
2. Z katalogu `deploy-homepl/api` z Twojego lokalnego repozytorium wyślij pliki `.php` na FTP do katalogu `api`.
3. Skopiuj również `deploy-homepl/config/config.example.php`, nadaj mu nazwę `config.php` i edytuj w nim poprawne dane z Kroku 3 (host bazy, użytkownik, hasło, nazwa bazy).

## 5. Przełączenie aplikacji na tryb Produkcyjny
Zanim wykonasz `npm run build`, upewnij się że posiadasz odpowiedni wpis konfiguracyjny (np. w `.env`):
`VITE_API_MODE="production"`
`VITE_API_BASE_URL="/rezerwacja/api"`
Wtedy aplikacja po zbudowaniu będzie pytać pliki PHP.

## 6. Testy Pomyślnego Wdrożenia
1. Wejdź na `https://twoja-domena.pl/rezerwacja/` i spróbuj przejść proces umawiania konsultacji.
2. Sprawdź tabelę `bookings` w swojej bazie phpMyAdmin czy wpis poprawnie się zarejestrował.
3. Wejdź na `https://twoja-domena.pl/rezerwacja/admin` aby upewnić się że z punktu API dla Administratora odpowiedź poprawnie ładuje pobraną listę wizyt z dzisiaj.

## 7. Konfiguracja Asystenta AI (Gemini) - Za darmo
System posiada wbudowanego inteligentnego asystenta do zarządzania kalendarzem głosem i tekstem, wspieranego przez najnowszy model Google Gemini.

1. Wejdź na stronę [Google AI Studio](https://aistudio.google.com/app/apikey) i zaloguj się swoim kontem Google.
2. Kliknij **Create API Key**. Jest to całkowicie bezpłatne (obsługuje darmowy próg 15 zapytań na minutę).
3. Skopiuj wygenerowany klucz.
4. W pliku `deploy-homepl/config/config.php` na serwerze Home.pl (lub lokalnie przed wysłaniem) podmień wartość:
```php
'gemini_api_key' => 'TWÓJ_WYGENEROWANY_KLUCZ_TUTAJ',
```
5. Asystent zacznie odpowiadać inteligentnie na polecenia.
