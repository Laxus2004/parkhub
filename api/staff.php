<?php
/* ==========================================================================
   ParkHub — Staff actions (staff.html)
   Every request is a POST with JSON: { "action": "...", ...fields }
   Every successful reply contains the fresh app state: { "state": {...} }

   entry    { plate, vehicle, driver, slotId }   → also returns { session }
   exit     { sessionId }                        → also returns { amount }
   approve  { reservationId }
   cancel   { reservationId }
   extend   { reservationId, hours }
   damage   { slotId }
   ========================================================================== */

require_once __DIR__ . '/config.php';

require_post();
$user = require_user($pdo, ['staff', 'superadmin']);
$data = input();
$action = $data['action'] ?? '';

/** Loads a pending reservation (locked) or stops with an error. */
function pending_reservation($pdo, $id)
{
    $stmt = $pdo->prepare("SELECT * FROM reservations WHERE id = ? AND status = 'pending' FOR UPDATE");
    $stmt->execute([$id]);
    $res = $stmt->fetch();
    if (!$res) fail('Reservation ' . $id . ' is no longer pending.', 404);
    return $res;
}

switch ($action) {

    /* ---------- walk-in vehicle enters ---------- */
    case 'entry':
        $plate = strtoupper(trim($data['plate'] ?? ''));
        $vehicle = $data['vehicle'] ?? '';
        $driver = trim($data['driver'] ?? '');
        $slotId = $data['slotId'] ?? '';
        if ($plate === '') fail('Enter the plate number.');
        if (!in_array($vehicle, ['Automobile', 'Motorcycle'], true)) fail('Choose a vehicle type.');

        $pdo->beginTransaction();
        $slot = require_slot_access($pdo, $user, $slotId);
        if ($slot['status'] !== 'available') fail('Slot ' . $slotId . ' is not available.');

        $session = [
            'id' => next_ticket_id($pdo),
            'account_username' => null,
            'plate' => $plate,
            'vehicle' => $vehicle,
            'driver' => $driver !== '' ? $driver : 'Walk-in',
            'slot' => $slotId,
            'entry' => now_ms(),
            'duration' => null,
            'reservation_id' => null,
        ];
        insert_session($pdo, $session);
        set_slot($pdo, $slotId, 'occupied', $plate);
        $pdo->commit();

        state_response($pdo, $user, ['session' => map_session($session)]);

        /* ---------- vehicle leaves: bill and free the slot ---------- */
    case 'exit':
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT * FROM sessions WHERE id = ? FOR UPDATE');
        $stmt->execute([$data['sessionId'] ?? '']);
        $session = $stmt->fetch();
        if (!$session) fail('That parking session has already ended.', 404);
        require_slot_access($pdo, $user, $session['slot']);

        $amount = close_session($pdo, $session, now_ms());
        $pdo->commit();

        state_response($pdo, $user, ['amount' => $amount]);

        /* ---------- driver arrives with a reservation ---------- */
    case 'approve':
        $pdo->beginTransaction();
        $res = pending_reservation($pdo, $data['reservationId'] ?? '');
        $slot = require_slot_access($pdo, $user, $res['slot']);

        insert_session($pdo, [
            'id' => next_ticket_id($pdo),
            'account_username' => $res['account_username'],
            'plate' => $res['plate'],
            'vehicle' => $res['vehicle'],
            'driver' => $res['driver'],
            'slot' => $res['slot'],
            'entry' => now_ms(),
            'duration' => (int) $res['hours'],
            'reservation_id' => $res['id'],
        ]);
        set_slot($pdo, $res['slot'], 'occupied', $res['plate']);
        $pdo->prepare("UPDATE reservations SET status = 'approved' WHERE id = ?")->execute([$res['id']]);

        if ($res['account_username']) {
            push_notification(
                $pdo,
                $res['account_username'],
                'approval',
                'Reservation Approved',
                'Your reservation ' . $res['id'] . ' for slot ' . $res['slot'] .
                    ' has been approved by staff. You are now checked in — welcome to ' . $slot['facility_name'] . '!',
                $res['id']
            );
        }
        $pdo->commit();

        state_response($pdo, $user);

        /* ---------- staff cancels a reservation ---------- */
    case 'cancel':
        $pdo->beginTransaction();
        $res = pending_reservation($pdo, $data['reservationId'] ?? '');
        require_slot_access($pdo, $user, $res['slot']);

        $pdo->prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?")->execute([$res['id']]);
        set_slot($pdo, $res['slot'], 'available');
        $pdo->commit();

        state_response($pdo, $user);

        /* ---------- add hours to a reservation ---------- */
    case 'extend':
        $hours = (int) ($data['hours'] ?? 0);
        if ($hours < 1 || $hours > 24) fail('Choose between 1 and 24 extra hours.');

        $pdo->beginTransaction();
        $res = pending_reservation($pdo, $data['reservationId'] ?? '');
        require_slot_access($pdo, $user, $res['slot']);

        $pdo->prepare('UPDATE reservations SET hours = hours + ? WHERE id = ?')->execute([$hours, $res['id']]);
        $pdo->commit();

        state_response($pdo, $user);

        /* ---------- report a damaged slot ---------- */
    case 'damage':
        $pdo->beginTransaction();
        $slot = require_slot_access($pdo, $user, $data['slotId'] ?? '');

        $stmt = $pdo->prepare('SELECT 1 FROM damage_reports WHERE slot_id = ? AND resolved = 0');
        $stmt->execute([$slot['id']]);
        if (!$stmt->fetch()) {
            $pdo->prepare(
                'INSERT INTO damage_reports (id, slot_id, facility_name, reported_by, timestamp, resolved)
                 VALUES (?, ?, ?, ?, ?, 0)'
            )->execute([uid(), $slot['id'], $slot['facility_name'], $user['display_name'], now_ms()]);
        }
        if ($slot['status'] === 'available') set_slot($pdo, $slot['id'], 'out_of_service');
        $pdo->commit();

        state_response($pdo, $user);

    default:
        fail('Unknown action.');
}
