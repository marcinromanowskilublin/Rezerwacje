<?php
require_once '../config/config.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $text = $data['text'] ?? '';

    if (empty($text)) {
        http_response_code(400);
        echo json_encode(['error' => 'Brak tekstu']);
        exit;
    }

    $apiKey = $config['gemini_api_key'] ?? '';
    if (empty($apiKey)) {
        http_response_code(500);
        // Fallback for demo if API key is not configured
        echo json_encode([
            'reply' => 'Tryb demonstracyjny PHP (brak klucza Gemini). Zrozumiałem: ' . htmlspecialchars($text),
            'action' => 'demo'
        ]);
        exit;
    }

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $apiKey;

    $prompt = "
Jesteś inteligentnym asystentem kalendarza medycznego Marcina Romanowskiego.
Twoim zadaniem jest zamiana tekstu użytkownika na obiekt JSON akcji.
Dzisiejsza data: " . date('Y-m-d') . ", " . date('l') . "

Zrozum intencję z tekstu: '$text'

Zwróć TYLKO I WYŁĄCZNIE czysty JSON w następującym formacie:
{
  \"reply\": \"przyjazna odpowiedź w języku polskim informująca co zrobiłeś\",
  \"action\": \"block_day|block_slot|book_visit|none\",
  \"details\": {
     \"date\": \"YYYY-MM-DD\",
     \"time\": \"HH:MM\",
     \"patient\": \"imię pacjenta\"
  }
}
Odpowiadaj krótko i profesjonalnie. Jeśli to rezerwacja na jutro, oblicz prawidłową datę.
";

    $payload = [
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ],
        'generationConfig' => [
            'response_mime_type' => 'application/json',
            'temperature' => 0.1
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        http_response_code(500);
        echo json_encode(['error' => 'Błąd komunikacji z AI', 'details' => $response]);
        exit;
    }

    $result = json_decode($response, true);
    $generatedText = $result['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
    
    // Pass the JSON straight through to the frontend
    echo $generatedText;
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
}
