<?php
/* ==========================================================================
   ParkHub — Database connection (included by every API file)
   XAMPP defaults: user "root", empty password.
   ========================================================================== */

define('DB_HOST', 'localhost');
define('DB_NAME', 'parkhub_db');
define('DB_USER', 'root');
define('DB_PASS', '');

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Manila');
session_start();

// Any unexpected error (for example a failed query) is undone and sent back as JSON.
set_exception_handler(function ($e) {
    global $pdo;
    if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
});

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false, // numbers come back as numbers
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

require_once __DIR__ . '/helpers.php';
