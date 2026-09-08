# Architektura Systemu Rezerwacji

## 1. Koncepcja ogólna
System jest zaprojektowany jako rozwiązanie API-first z podziałem na warstwę frontendową (React) oraz backendową (PHP dla docelowego wdrożenia home.pl). Pomiędzy nimi komunikację zapewnia centralny moduł `BookingApi`.

## 2. Dwa tryby API (Feature Flags)
Za pomocą zmiennej środowiskowej `VITE_API_MODE` (lub w pliku `config/features.ts`) aplikacja może działać w jednym z dwóch trybów:
- **Mock (`mock`)**: Wszystkie operacje na danych, rezerwacje, blokady czy symulacja płatności przeprowadzane są w pamięci lokalnej przeglądarki. Ten tryb używany jest do testów (np. w Google AI Studio).
- **Production (`production`)**: Interfejs `BookingApi` wysyła asynchroniczne żądania `fetch` pod adres zdefiniowany w `API_BASE_URL` (domyślnie `/rezerwacja/api`), z którego serwowane są skrypty PHP współpracujące z bazą MySQL.

## 3. Komponenty Frontendu (React)
Zbudowane zgodnie z zasadami "Mobile-first" oraz eleganckiego minimalizmu, ukrywając techniczne zawiłości.
- **Providerzy:** 
  - `BookingProvider` – zarządza aktualnym stanem "koszyka" umawiania wizyty (rodzaj wizyty, data, godzina, dane pacjenta).
- **Struktura katalogów:**
  - `src/pages/patient`: Ekran startowy (`BookingStart`), wybór dnia (`DaySelector`), wybór godziny (`SlotSelector`), formularz danych (`PatientForm`), podsumowanie z płatnością (`Summary`) oraz potwierdzenie (`Confirmation`). Jest też panel zarządzania wizytą pacjenta.
  - `src/pages/admin`: Prosty panel z podglądem na dzienny terminarz (`AdminDashboard`).
  - `src/components`: UI i komponenty pomocnicze (np. stylizowany przycisk z radixa/cva).

## 4. Repozytorium i API Core (`src/services`)
Aby unikać dublowania żądań z różnych miejsc, wszystko przechodzi przez `bookingApi.ts`. To on decyduje w jakim trybie jesteśmy, dzięki czemu logika komponentów nie musi się tym martwić.

## 5. Zewnętrzni Providerzy (Extension points)
Aplikacja została przygotowana na przyszłe integracje:
- **PaymentProvider** (`src/providers/PaymentProvider.ts`) - Domyślnie zaimplementowany jako `MockPaymentProvider`. Architektura gotowa na rozszerzenie m.in. na Przelewy24, PayU, BLIK. Backend blokuje termin do momentu przetworzenia webhooka (bądź wygaśnięcia).
- **NotificationProvider** - Miejsce na wysyłanie e-maili (np. Gmail). Na ten moment Mock z użyciem `console.log()`.
- **CalendarProvider / MeetingProvider** - Miejsca integracji np. z Google Calendar i Google Meet dla pacjentów oraz administratora. Na razie interfejs.

## 6. Model Danych (Baza Danych - Schema)
Model bazodanowy chroni nas przed overbookingiem, głównie przy użyciu unikalnych ograniczeń.
- `visit_types` - cennik, czasy trwania, polityka płatności.
- `availability_rules` - tygodniowy harmonogram.
- `blocked_periods` - dni wolne/urlopy.
- `bookings` - wizyty z unikalnym indeksem `idx_booking_time (booking_date, start_time, status)`. Status 'cancelled' pozwala na zwolnienie terminu.
- `payments` - statusy, powiązanie do `bookings`. 

## 7. Czego celowo NIE implementujemy
- Dokumentacji medycznej, recept, systemu e-ZLA.
- Rzeczywistych integracji (Przelewy24, Google API, OAuth).
- Frameworków MVC w PHP (jak Laravel/Symfony). Wszystko po to, by działało sprawnie na najprostszym hostingu bez konieczności kompilacji po stronie serwera.
