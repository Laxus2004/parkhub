<?php
/* ==========================================================================
   ParkHub — Authentication

   GET  api/auth.php                       → who is signed in
   POST api/auth.php {action: "login",    username, password}
   POST api/auth.php {action: "register", username, firstName, lastName,
                                         contact, email, password}
   POST api/auth.php {action: "logout"}
   ========================================================================== */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $user = current_user($pdo);
    respond(['account' => $user ? map_account($user) : null]);
}

$data = input();
$action = $data['action'] ?? '';

switch ($action) {

    case 'login':
        $key = strtolower(trim($data['username'] ?? ''));
        $password = $data['password'] ?? '';
        if ($key === '' || $password === '') fail('Enter your username / email and password.');

        $stmt = $pdo->prepare('SELECT * FROM accounts WHERE username = ? OR LOWER(email) = ?');
        $stmt->execute([$key, $key]);
        $user = $stmt->fetch();

        $stored = $user ? $user['password'] : '';
        if (!$user || !password_matches($stored, $password)) fail('Invalid username / email or password.', 401);

        // Upgrade a plain-text password to a secure hash on first sign in.
        if (!is_hashed($stored)) {
            $pdo->prepare('UPDATE accounts SET password = ? WHERE username = ?')
                ->execute([password_hash($password, PASSWORD_DEFAULT), $user['username']]);
        }

        session_regenerate_id(true);
        $_SESSION['username'] = $user['username'];
        respond(['account' => map_account($user)]);

    case 'register':
        $username = strtolower(trim($data['username'] ?? ''));
        $email = strtolower(trim($data['email'] ?? ''));
        $first = trim($data['firstName'] ?? '');
        $last = trim($data['lastName'] ?? '');
        $contact = trim($data['contact'] ?? '');
        $password = $data['password'] ?? '';

        if ($username === '' || $first === '' || $last === '' || $contact === '' || $email === '') {
            fail('Please fill in every field.');
        }
        if (preg_match('/\s/', $username)) fail('Usernames cannot contain spaces.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Please enter a valid email address.');
        if (!strong_password($password)) fail('Please meet all password requirements.');

        $stmt = $pdo->prepare('SELECT 1 FROM accounts WHERE username = ?');
        $stmt->execute([$username]);
        if ($stmt->fetch()) fail('That username is already taken.');

        $stmt = $pdo->prepare('SELECT 1 FROM accounts WHERE LOWER(email) = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) fail('An account with this email already exists.');

        $displayName = trim($first . ' ' . $last);
        $pdo->prepare(
            "INSERT INTO accounts (username, password, role, display_name, first_name, last_name, email, contact)
             VALUES (?, ?, 'driver', ?, ?, ?, ?, ?)"
        )->execute([$username, password_hash($password, PASSWORD_DEFAULT), $displayName, $first, $last, $email, $contact]);

        respond(['displayName' => $displayName], 201);

    case 'logout':
        $_SESSION = [];
        session_destroy();
        respond(['ok' => true]);

    default:
        fail('Unknown action.');
}
