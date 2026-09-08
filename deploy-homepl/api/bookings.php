<?php
require_once '../config/config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = new PDO("mysql:host=" . $config['db_host'] . ";dbname=" . $config['db_name'] . ";charset=" . $config['db_charset'], $config['db_user'], $config['db_pass']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // GET /bookings or /bookings?token=...
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (isset($_GET['token'])) {
            $stmt = $pdo->prepare("SELECT * FROM bookings WHERE management_token = ?");
            $stmt->execute([$_GET['token']]);
            $booking = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($booking) {
                echo json_encode($booking);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Not found']);
            }
        } else {
            // Admin only (requires auth in real app)
            $stmt = $pdo->query("SELECT * FROM bookings ORDER BY created_at DESC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        }
        exit;
    }
    
    // DELETE /bookings?token=... (Cancel booking by token)
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        if (isset($_GET['token'])) {
            $stmt = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE management_token = ?");
            $stmt->execute([$_GET['token']]);
            if ($stmt->rowCount() > 0) {
                echo json_encode(['status' => 'cancelled']);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Not found']);
            }
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $email = $data['patient_email'] ?? '';
        
        // 1. Check double booking for the same slot
        $stmtConflict = $pdo->prepare("SELECT id FROM bookings WHERE booking_date = ? AND start_time = ? AND status != 'cancelled'");
        $stmtConflict->execute([$data['booking_date'], $data['start_time']]);
        if ($stmtConflict->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Termin jest już zajęty.']);
            exit;
        }

        // 2. Check email limits (max 2 active bookings)
        if ($email) {
            $stmtLimit = $pdo->prepare("SELECT count(*) as cnt FROM bookings WHERE patient_email = ? AND status IN ('pending', 'confirmed')");
            $stmtLimit->execute([$email]);
            $row = $stmtLimit->fetch();
            if ($row['cnt'] >= 2) {
                http_response_code(429);
                echo json_encode(['error' => 'Wykorzystano limit aktywnych rezerwacji dla tego adresu email.']);
                exit;
            }
        }

        $id = uniqid('b_');
        $token = bin2hex(random_bytes(16));
        
        $stmt = $pdo->prepare("INSERT INTO bookings (id, visit_type_id, booking_date, start_time, end_time, patient_name, patient_email, patient_phone, status, payment_status, management_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)");
        
        $stmt->execute([
            $id,
            $data['visit_type_id'],
            $data['booking_date'],
            $data['start_time'],
            $data['start_time'], // end time simplified
            $data['patient_name'],
            $data['patient_email'],
            $data['patient_phone'],
            $data['payment_status'] ?? 'unpaid',
            $token
        ]);
        
        // SEND EMAIL NOTIFICATION
        if ($email) {
            $to = $email;
            $subject = "Potwierdzenie rezerwacji wizyty - Marcin Romanowski";
            $headers = "From: noreply@twoja-domena.pl\r\n";
            $headers .= "Reply-To: kontakt@twoja-domena.pl\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            
            $manageUrl = "https://" . $_SERVER['HTTP_HOST'] . "/manage/" . $token;
            
            $message = "
            <html>
            <body style='font-family: sans-serif; color: #111827; background: #FAFAFA; padding: 20px;'>
                <div style='max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; border: 1px solid #E5E7EB;'>
                    <h2 style='font-weight: 300; font-size: 24px; margin-bottom: 20px;'>Wizyta zaplanowana</h2>
                    <p>Witaj " . htmlspecialchars($data['patient_name']) . ",</p>
                    <p>Twoja wizyta w gabinecie Marcin Romanowski została zarezerwowana.</p>
                    <div style='margin: 20px 0; border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 15px 0;'>
                        <p><strong>Data:</strong> " . $data['booking_date'] . "</p>
                        <p><strong>Godzina:</strong> " . $data['start_time'] . "</p>
                        <p><strong>Miejsce:</strong> Marcin Romanowski, ul. Testowa 1, Warszawa (test)</p>
                    </div>
                    <p style='margin-bottom: 20px;'>Jeśli musisz zrezygnować, możesz w każdej chwili odwołać wizytę klikając w poniższy link:</p>
                    <a href='" . $manageUrl . "' style='display: inline-block; background: #111827; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;'>Zarządzaj / Odwołaj wizytę</a>
                    <p style='margin-top: 30px; font-size: 12px; color: #6B7280;'>Prosimy nie odpowiadać na tę wiadomość.</p>
                </div>
            </body>
            </html>
            ";
            
            @mail($to, $subject, $message, $headers);
        }

        $stmt = $pdo->prepare("SELECT * FROM bookings WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error', 'msg' => $e->getMessage()]);
}
