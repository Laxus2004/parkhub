<?php
/* ==========================================================================
   ParkHub — Driver reminder and expiry engine

   The driver page calls this endpoint when it opens and every 30 seconds.
   The fired_alerts table guarantees that each reminder is created once,
   even if two browser tabs call the endpoint at the same time.
   ========================================================================== */

require_once __DIR__ . '/config.php';

require_post();
$user = require_user($pdo, ['driver']);
$username = $user['username'];
$now = now_ms();
$breakpoints = [30, 25, 20, 15, 10, 5];
$created = 0;

/**
 * Claims one alert flag. INSERT IGNORE returns 1 only for a new row, so the
 * caller that successfully inserts the flag is the only one that sends it.
 */
function fire_once($pdo, $username, $alertKey, $flag)
{
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO fired_alerts (username, alert_key, flag) VALUES (?, ?, ?)'
    );
    $stmt->execute([$username, $alertKey, $flag]);
    return $stmt->rowCount() === 1;
}

$pdo->beginTransaction();

/* ---------- pending reservation reminders ---------- */

$stmt = $pdo->prepare(
    "SELECT * FROM reservations
     WHERE account_username = ? AND status = 'pending'
     ORDER BY date, time
     FOR UPDATE"
);
$stmt->execute([$username]);
$reservations = $stmt->fetchAll();

foreach ($reservations as $reservation) {
    $start = strtotime($reservation['date'] . ' ' . $reservation['time']) * 1000;
    $end = $start + (int) $reservation['hours'] * 3600000;
    $toArrival = ($start - $now) / 60000;
    $toExpiry = ($end - $now) / 60000;
    $key = 'res:' . $reservation['id'];

    if ($toArrival <= 20 && $toArrival > 0 && fire_once($pdo, $username, $key, 'arrival')) {
        $minutesUntilArrival = max(1, (int) ceil($toArrival));
        push_notification(
            $pdo,
            $username,
            'reminder',
            'Parking Reminder — Arrival in ' . $minutesUntilArrival . ' min',
            'Your reserved slot ' . $reservation['slot'] . ' (' . $reservation['id'] .
                ') is scheduled for ' . clock_ms($start) . ' — ' . $minutesUntilArrival .
                ' minute' . ($minutesUntilArrival !== 1 ? 's' : '') .
                ' remaining. Please head to the facility now.',
            $reservation['id']
        );
        $created++;
    }

    if ($toArrival <= 0 && $toExpiry > 0 && fire_once($pdo, $username, $key, 'overdue')) {
        push_notification(
            $pdo,
            $username,
            'overdue',
            'Reservation Overdue — Missed Arrival',
            'You missed your arrival time for slot ' . $reservation['slot'] . ' (' .
                $reservation['id'] . '). Your ' . $reservation['hours'] .
                '-hour reservation window is still active and expires at ' . clock_ms($end) . '.',
            $reservation['id']
        );
        $created++;
    }

    foreach ($breakpoints as $minutes) {
        if ($toExpiry <= $minutes && $toExpiry > 0 && fire_once($pdo, $username, $key, 'exp' . $minutes)) {
            $left = (int) ceil($toExpiry);
            push_notification(
                $pdo,
                $username,
                'expiry',
                'Reservation Expires in ' . $minutes . ' min',
                'Slot ' . $reservation['slot'] . ' (' . $reservation['id'] . ') expires at ' .
                    clock_ms($end) . ' — ' . $left . ' minute' . ($left !== 1 ? 's' : '') .
                    ' remaining. Renew your stay or vacate to avoid automatic cancellation.',
                $reservation['id']
            );
            $created++;
        }
    }

    if ($toExpiry <= 0 && fire_once($pdo, $username, $key, 'cancelled')) {
        $pdo->prepare("UPDATE reservations SET status = 'expired' WHERE id = ? AND status = 'pending'")
            ->execute([$reservation['id']]);
        $pdo->prepare(
            "UPDATE slots SET status = 'available', plate = NULL
             WHERE id = ? AND status = 'reserved'"
        )->execute([$reservation['slot']]);

        push_notification(
            $pdo,
            $username,
            'overdue',
            'Reservation Cancelled — Time Expired',
            'Your ' . $reservation['hours'] . '-hour reservation ' . $reservation['id'] .
                ' for slot ' . $reservation['slot'] . ' expired at ' . clock_ms($end) .
                ' and has been automatically cancelled. The slot is now available.',
            $reservation['id']
        );
        $created++;
    }
}

/* ---------- active parking expiry reminders ---------- */

$stmt = $pdo->prepare(
    'SELECT * FROM sessions
     WHERE account_username = ? AND duration IS NOT NULL
     ORDER BY entry
     FOR UPDATE'
);
$stmt->execute([$username]);
$sessions = $stmt->fetchAll();

foreach ($sessions as $session) {
    $end = (int) $session['entry'] + (int) $session['duration'] * 3600000;
    $toExpiry = ($end - $now) / 60000;
    $key = 'session:' . $session['id'];

    foreach ($breakpoints as $minutes) {
        if ($toExpiry <= $minutes && $toExpiry > 0 && fire_once($pdo, $username, $key, 'exp' . $minutes)) {
            $left = (int) ceil($toExpiry);
            push_notification(
                $pdo,
                $username,
                'expiry',
                'Parking Expires in ' . $minutes . ' min',
                'Slot ' . $session['slot'] . ' (' . $session['id'] . ') expires at ' .
                    clock_ms($end) . ' — ' . $left . ' minute' . ($left !== 1 ? 's' : '') .
                    ' remaining. Extend your stay or prepare to vacate the slot.'
            );
            $created++;
        }
    }

    if ($toExpiry <= 0 && fire_once($pdo, $username, $key, 'ended')) {
        close_session($pdo, $session, $now);
        push_notification(
            $pdo,
            $username,
            'overdue',
            'Parking Session Expired',
            'Your session ' . $session['id'] . ' for slot ' . $session['slot'] .
                ' expired at ' . clock_ms($end) .
                ' and has been automatically ended. Please vacate the slot.'
        );
        $created++;
    }
}

$pdo->commit();
state_response($pdo, $user, ['alertsCreated' => $created]);
