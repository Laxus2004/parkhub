<?php
/* ==========================================================================
   ParkHub — Super Admin actions (superadmin.html)
   POST JSON: { "action": "...", ...fields }  → reply { "state": {...} }

   resolve         { reportId }   damage fixed: slot becomes available again
   out_of_service  { slotId }     take a slot out of service
   reset           {}             clear all parking data back to the seed
   ========================================================================== */

require_once __DIR__ . '/config.php';

require_post();
$user = require_user($pdo, ['superadmin']);
$data = input();
$action = $data['action'] ?? '';

// Slots that start out of service (same as outOfService in data.js).
const SEED_OUT_OF_SERVICE = ['B-03', 'C-08', 'F-07', 'G-04'];

switch ($action) {

    case 'resolve':
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT * FROM damage_reports WHERE id = ? FOR UPDATE');
        $stmt->execute([$data['reportId'] ?? '']);
        $report = $stmt->fetch();
        if (!$report) fail('Damage report not found.', 404);

        $pdo->prepare('UPDATE damage_reports SET resolved = 1 WHERE id = ?')->execute([$report['id']]);
        $pdo->prepare("UPDATE slots SET status = 'available', plate = NULL WHERE id = ? AND status = 'out_of_service'")
            ->execute([$report['slot_id']]);
        $pdo->commit();

        state_response($pdo, $user);

    case 'out_of_service':
        $slot = find_slot($pdo, $data['slotId'] ?? '');
        if (!$slot) fail('Slot not found.', 404);
        $pdo->prepare("UPDATE slots SET status = 'out_of_service' WHERE id = ?")->execute([$slot['id']]);

        state_response($pdo, $user);

        /* Accounts are kept so registered drivers are not lost. */
    case 'reset':
        $pdo->beginTransaction();
        foreach (['notifications', 'fired_alerts', 'history', 'sessions', 'reservations', 'damage_reports'] as $table) {
            $pdo->exec('DELETE FROM ' . $table);
        }
        $pdo->exec("UPDATE slots SET status = 'available', plate = NULL");

        $marks = implode(',', array_fill(0, count(SEED_OUT_OF_SERVICE), '?'));
        $pdo->prepare("UPDATE slots SET status = 'out_of_service' WHERE id IN ($marks)")->execute(SEED_OUT_OF_SERVICE);
        $pdo->prepare(
            "INSERT INTO damage_reports (id, slot_id, facility_name, reported_by, timestamp, resolved)
             SELECT CONCAT('seed-', s.id), s.id, f.name, 'System', ?, 0
             FROM slots s JOIN facilities f ON f.id = s.facility_id
             WHERE s.status = 'out_of_service'"
        )->execute([now_ms()]);
        $pdo->commit();

        state_response($pdo, $user);

    default:
        fail('Unknown action.');
}
