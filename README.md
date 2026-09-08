# Rezerwacja Wizyt

Ten projekt stanowi kompletną wizytówkę dla prywatnego gabinetu psychiatrycznego z systemem rezerwacji.
Głównym założeniem systemu jest prostota dla pacjentów oraz możliwość uruchomienia na podstawowym, współdzielonym hostingu PHP (np. home.pl) po dokonaniu swobodnego developmentu.

Zarządzanie wizytami, ustawienia dostępności, reguły, oraz płatności przewidują podłączenie przyszłych modułów, bez wprowadzania mikrousług czy zależności np. od ekosystemu NodeJS.

## Cechy 
1. Estetyczny design mobile-first (TailwindCSS)
2. Architektura API-First
3. Mechanizm zarządzania wizytami przez pacjenta na podstawie tokenu
4. Panel Admina do bieżącego zarządzania wizytami z dzisiaj 

## Rozwój lokalnie (Preview)
1. Klonuj repozytorium.
2. `npm install`
3. Zostaw domyślną konfigurację `VITE_API_MODE=mock`.
4. `npm run dev` i otwieraj w przeglądarce. Wszystko symulowane jest bez backendu (tzw. Mock Mode).

## Budowanie i Wdrażanie (Production)
1. Zmień `VITE_API_MODE=production`.
2. Opcjonalnie zaktualizuj `VITE_API_BASE_URL` dla własnej domeny.
3. Odpal `npm run build`.
4. Skompilowany projekt w katalogu `/dist` wgraj przez FTP na swój hosting (np. home.pl).
5. Postępuj zgodnie z instrukcją podaną w pliku `deploy-homepl/README_HOMEPL.md` by skonfigurować bazę danych i PHP.

Aby przeczytać o detalach i planach przyszłej rozbudowy wejdź do pliku `ARCHITECTURE.md`.
