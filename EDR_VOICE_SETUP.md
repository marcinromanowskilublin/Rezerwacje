# Dyktowanie wizyty do MyDr EDR

## Stan

Panel administratora ma przycisk **Dyktuj do EDR** przy każdej rezerwacji. Przepływ:

1. wyszukuje wizyty MyDr o tej samej dacie i godzinie,
2. pobiera pacjenta i pozwala wybrać tylko wizytę z identycznym imieniem i nazwiskiem,
3. nagrywa dźwięk po potwierdzeniu poinformowania pacjenta,
4. wysyła audio do europejskiego endpointu Deepgram (`nova-3`, język polski, `mip_opt_out=true`),
5. pokazuje edytowalną transkrypcję,
6. po potwierdzeniu ponownie sprawdza pacjenta, termin i wersję wizyty,
7. dopisuje tekst do pola `interview` metodą `PATCH`.

Audio nie jest zapisywane przez aplikację. Klucze nie trafiają do przeglądarki.

## Konfiguracja serwera

Sekrety trzeba dodać wyłącznie do ignorowanego przez Git pliku
`deploy-homepl/config/config.php` na serwerze. Nie wolno kopiować `1.txt` do repozytorium.

```php
'edr_enabled' => true,
'edr_base_url' => 'https://edm.mydr.pl',
'edr_client_id' => '...',
'edr_client_secret' => '...',
'edr_access_token' => '...',
'edr_refresh_token' => '...',
// Bezwzględna ścieżka poza katalogiem publicznym, zapisywalna tylko dla PHP.
'edr_token_file' => '/home/ACCOUNT/private/edr-oauth-tokens.json',
'edr_doctor_id' => 0,
'edr_office_id' => 0,
'edr_spoken_note_sync_enabled' => true,

'deepgram_api_key' => '...',
'deepgram_base_url' => 'https://api.eu.deepgram.com',
```

Można też użyć zmiennych środowiskowych:

- `EDR_CLIENT_ID`
- `EDR_CLIENT_SECRET`
- `EDR_ACCESS_TOKEN`
- `EDR_REFRESH_TOKEN`
- `EDR_TOKEN_FILE`
- `EDR_DOCTOR_ID`
- `EDR_OFFICE_ID`
- `EDR_SPOKEN_NOTE_SYNC_ENABLED`
- `DEEPGRAM_API_KEY`
- `DEEPGRAM_BASE_URL`

`EDR_TOKEN_FILE` jest wymagany w środowisku produkcyjnym. MyDr może rotować Refresh
Token, dlatego plik musi być trwały, poza katalogiem publicznym i mieć uprawnienia `0600`.

## Warunki uruchomienia

Przed użyciem na danych pacjentów należy:

- zawrzeć i zweryfikować umowę powierzenia z dostawcą transkrypcji,
- uzupełnić obowiązek informacyjny i politykę prywatności,
- ustalić podstawę prawną nagrywania oraz procedurę potwierdzania jej w gabinecie,
- włączyć indywidualne konta administratorów, MFA i audyt dostępu przed szerszym użyciem,
- wykonać test na koncie demonstracyjnym MyDr, a nie na realnej karcie pacjenta.

Automatyczne dopasowanie po samym nazwisku lub godzinie jest celowo niedozwolone.
