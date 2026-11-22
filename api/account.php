<?php
/* ==========================================================================
   ParkHub — Profile and notifications (any signed-in user)
   POST JSON: { "action": "...", ...fields }  → reply { "state": {...} }

   update_profile  { displayName?, email?, contact?, currentPassword?, newPassword? }
                   → also returns { account }
   mark_all_read   {}
   dismiss         { id }
   clear           {}
   ========================================================================== */

require_once __DIR__ . '/config.php';

require_post();
$user = require_user($pdo);
$username = $user['username'];
$data = input();
$action = $data['action'] ?? '';

switch ($action) {

    case 'update_profile':
        $fields = [];
        $params = [];

        if (isset($data['displayName']) && trim($data['displayName']) !== '') {
            $fields[] = 'display_name = ?';
            $params[] = trim($data['displayName']);
        }

        if (!empty($data['email'])) {
            $email = strtolower(trim($data['email']));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Please enter a valid email address.');
            $stmt = $pdo->prepare('SELECT 1 FROM accounts WHERE LOWER(email) = ? AND username <> ?');
            $stmt->execute([$email, $username]);
            if ($stmt->fetch()) fail('That email address is already used by another account.');
            $fields[] = 'email = ?';
            $params[] = $email;
        }

        if (isset($data['contact'])) {
            $fields[] = 'contact = ?';
            $params[] = trim($data['contact']);
        }

        if (!empty($data['newPassword'])) {
            if (!password_matches($user['password'], $data['currentPassword'] ?? '')) {
                fail('The current password is incorrect.');
            }
            if (!strong_password($data['newPassword'])) {
                fail('Use at least 8 characters with an uppercase letter, number, and special character.');
            }
            $fields[] = 'password = ?';
            $params[] = password_hash($data['newPassword'], PASSWORD_DEFAULT);
        }

        if ($fields) {
            $params[] = $username;
            $pdo->prepare('UPDATE accounts SET ' . implode(', ', $fields) . ' WHERE username = ?')->execute($params);
        }

        $user = current_user($pdo);
        state_response($pdo, $user, ['account' => map_account($user)]);

    case 'mark_all_read':
        $pdo->prepare('UPDATE notifications SET `read` = 1 WHERE username = ?')->execute([$username]);
        state_response($pdo, $user);

    case 'dismiss':
        $pdo->prepare('DELETE FROM notifications WHERE id = ? AND username = ?')->execute([$data['id'] ?? '', $username]);
        state_response($pdo, $user);

    case 'clear':
        $pdo->prepare('DELETE FROM notifications WHERE username = ?')->execute([$username]);
        state_response($pdo, $user);

    default:
        fail('Unknown action.');
}
