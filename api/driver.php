<?php
/* ==========================================================================
   ParkHub — Driver actions (driver.html)
   POST JSON: { "action": "...", ...fields }  → reply { "state": {...} }

   reserve  { slotId, plate, driver, vehicle, date, time, hours }  → also { reservation }
   cancel   { reservationId }
   extend   { sessionId, hours }
   ========================================================================== */

require_once __DIR__ . '/config.php';

require_post();
$user = require_user($pdo, ['driver']);
$username = $user['username'];
$data = input();
$action = $data['action'] ?? '';

/** Next reservation number, e.g. "RSV-005". */
function next_reservation_id($pdo)
{
    $n = $pdo->query(
        'SELECT GREATEST(COALESCE(MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)), 0), 4) FROM reservations'
    )->fetchColumn();
    return 'RSV-' . str_pad((string) ((int) $n + 1), 3, '0', STR_PAD_LEFT);
}

switch ($action) {

    /* ---------- reserve a slot ---------- */
    case 'reserve':
        $slotId = $data['slotId'] ?? '';
        $plate = strtoupper(trim($data['plate'] ?? ''));
        $driver = trim($data['driver'] ?? '');
        $vehicle = $data['vehicle'] ?? '';
        $date = $data['date'] ?? '';
        $time = $data['time'] ?? '';
        $hours = (int) ($data['hours'] ?? 0);

        if ($plate === '') fail('Enter your plate number.');
        if (!in_array($vehicle, ['Automobile', 'Motorcycle'], true)) fail('Choose a vehicle type.');
        if ($hours < 2 || $hours > 24) fail('Reservations are between 2 and 24 hours.');
        $start = DateTime::createFromFormat('Y-m-d H:i', $date . ' ' . $time);
        if (!$start || $start->format('Y-m-d H:i') !== $date . ' ' . $time) fail('Choose a valid date and time.');
        if ($date < date('Y-m-d')) fail('The reservation date has already passed.');

        $pdo->beginTransaction();
        $slot = find_slot($pdo, $slotId);
        if (!$slot) fail('Slot ' . $slotId . ' does not exist.', 404);
        if ($slot['status'] !== 'available') fail('Sorry, slot ' . $slotId . ' was just taken. Please pick another slot.', 409);
        if ($slot['vehicle_type'] !== $vehicle) fail('Slot ' . $slotId . ' is for ' . $slot['vehicle_type'] . 's only.');

        $reservation = [
            'id' => next_reservation_id($pdo),
            'account_username' => $username,
            'plate' => $plate,
            'vehicle' => $vehicle,
            'driver' => $driver !== '' ? $driver : 'Walk-in',
            'slot' => $slotId,
            'date' => $date,
            'time' => $time,
            'hours' => $hours,
        ];
        $pdo->prepare(
            "INSERT INTO reservations (id, account_username, plate, vehicle, driver, slot, date, time, hours, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
        )->execute(array_values($reservation));
        set_slot($pdo, $slotId, 'reserved', $plate);
        $pdo->commit();

        state_response($pdo, $user, ['reservation' => map_reservation($reservation)]);

        /* ---------- cancel my reservation ---------- */
    case 'cancel':
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT * FROM reservations WHERE id = ? AND account_username = ? FOR UPDATE');
        $stmt->execute([$data['reservationId'] ?? '', $username]);
        $res = $stmt->fetch();
        if (!$res) fail('Reservation not found.', 404);
        if ($res['status'] === 'approved') fail('You are already checked in for this reservation.');

        if ($res['status'] === 'pending') set_slot($pdo, $res['slot'], 'available');
        $pdo->prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?")->execute([$res['id']]);
        $pdo->commit();

        state_response($pdo, $user);

        /* ---------- add hours to my active parking ---------- */
    case 'extend':
        $hours = (int) ($data['hours'] ?? 0);
        if ($hours < 1 || $hours > 12) fail('Choose between 1 and 12 extra hours.');

        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT * FROM sessions WHERE id = ? AND account_username = ? FOR UPDATE');
        $stmt->execute([$data['sessionId'] ?? '', $username]);
        $session = $stmt->fetch();
        if (!$session) fail('That parking session has already ended.', 404);

        $duration = (int) $session['duration'] + $hours;
        $pdo->prepare('UPDATE sessions SET duration = ? WHERE id = ?')->execute([$duration, $session['id']]);

        // Let the expiry reminders fire again for the new end time.
        $pdo->prepare('DELETE FROM fired_alerts WHERE username = ? AND alert_key = ?')
            ->execute([$username, 'session:' . $session['id']]);

        push_notification(
            $pdo,
            $username,
            'approval',
            'Parking Extended',
            'Slot ' . $session['slot'] . ' (' . $session['id'] . ') extended by ' . $hours . 'h. New expiry: ' .
                clock_ms((int) $session['entry'] + $duration * 3600000) . '.'
        );
        $pdo->commit();

        state_response($pdo, $user);

    default:
        fail('Unknown action.');
}
