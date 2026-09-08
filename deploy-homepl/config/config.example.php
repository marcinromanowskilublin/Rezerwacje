<?php
// Skopiuj ten plik i zmień nazwę na config.php

$config = [
    // Ustawienia bazy danych Home.pl
    'db_host' => 'localhost',
    'db_name' => 'nazwa_bazy',
    'db_user' => 'uzytkownik_bazy',
    'db_pass' => 'haslo_bazy',
    'db_charset' => 'utf8mb4',
    
    // Klucz API Gemini (Google AI Studio) - wymagany do asystenta kalendarza
    // Zdobądź za darmo na: https://aistudio.google.com/app/apikey
    'gemini_api_key' => 'TUTAJ_WKLEJ_SWOJ_KLUCZ_GEMINI',
];
