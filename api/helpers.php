<?php
/* ==========================================================================
   ParkHub — Shared helpers: JSON responses, auth checks, and converting
   database rows into the exact shape the frontend (store.js) expects.
   ========================================================================== */

/* ---------- request / response ---------- */

function respond($data, $status = 200)
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

/**
 * Sends an error and stops. If a transaction is open it is never committed,
 * so MySQL rolls it back automatically — nothing is half-saved.
 */
function fail($message, $status = 400)
{
    respond(['error' => $message], $status);
}

/** Reads the JSON body sent by fetch(). */
function input()
{
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

/** Current time in JavaScript milliseconds, same as Date.now(). */
function now_ms()
{
    return (int) round(microtime(true) * 1000);
}

/** Stops the request unless it is a POST (all actions change data). */
function require_post()
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST for this request.', 405);
}

/* ---------- authentication ---------- */

function current_user($pdo)
{
    if (empty($_SESSION['username'])) return null;
    $stmt = $pdo->prepare('SELECT * FROM accounts WHERE username = ?');
    $stmt->execute([$_SESSION['username']]);
    return $stmt->fetch() ?: null;
}

/** Stops the request unless someone is signed in (optionally with one of $roles). */
function require_user($pdo, $roles = [])
{
    $user = current_user($pdo);
    if (!$user) fail('Please sign in first.', 401);
    if ($roles && !in_array($user['role'], $roles, true)) fail('You are not allowed to do that.', 403);
    return $user;
}

function is_hashed($stored)
{
    return !empty(password_get_info($stored)['algo']);
}

/** Seed accounts still have plain-text passwords ("12345"); everything else is hashed. */
function password_matches($stored, $given)
{
    return is_hashed($stored) ? password_verify($given, $stored) : hash_equals($stored, $given);
}

/** Same rules as the register form: 8+ characters, an uppercase letter, a number, a special character. */
function strong_password($p)
{
    return strlen($p) >= 8 && preg_match('/[A-Z]/', $p) && preg_match('/[0-9]/', $p) && preg_match('/[^A-Za-z0-9]/', $p);
}

/* ---------- row → frontend object ---------- */

function map_account($r)
{
    $a = [
        'username' => $r['username'],
        'role' => $r['role'],
        'displayName' => $r['display_name'],
    ];
    if ($r['first_name'] !== null) $a['firstName'] = $r['first_name'];
    if ($r['last_name'] !== null) $a['lastName'] = $r['last_name'];
    if ($r['email'] !== null) $a['email'] = $r['email'];
    if ($r['contact'] !== null) $a['contact'] = $r['contact'];
    if ($r['facility_id'] !== null) $a['facilityId'] = $r['facility_id'];
    return $a; // the password is never sent to the browser
}

function map_facility($r)
{
    return [
        'id' => $r['id'],
        'name' => $r['name'],
        'address' => $r['address'],
        'distanceKm' => (float) $r['distance_km'],
        'total' => (int) $r['total_slots'],
        'ratePerHour' => (float) $r['rate_per_hour'],
        'motorcycleRate' => (float) $r['motorcycle_rate'],
        'open' => $r['hours'],
        'zones' => explode(',', $r['zones']),
        'photo' => $r['photo'],
    ];
}

function map_slot($r)
{
    return [
        'id' => $r['id'],
        'zone' => $r['zone'],
        'facilityId' => $r['facility_id'],
        'status' => $r['status'],
        'plate' => $r['plate'],
        'isPwd' => (bool) $r['is_pwd'],
        'vehicleType' => $r['vehicle_type'],
    ];
}

function map_session($r)
{
    $s = [
        'id' => $r['id'],
        'accountUsername' => $r['account_username'],
        'plate' => $r['plate'],
        'vehicle' => $r['vehicle'],
        'driver' => $r['driver'],
        'slot' => $r['slot'],
        'entry' => (int) $r['entry'],
        'duration' => $r['duration'] === null ? null : (int) $r['duration'],
        'reservationId' => $r['reservation_id'],
    ];
    if (array_key_exists('exit', $r)) {
        $s['exit'] = (int) $r['exit'];
        $s['amount'] = (float) $r['amount'];
        $s['paid'] = (bool) $r['paid'];
    }
    return $s;
}

function map_reservation($r)
{
    return [
        'id' => $r['id'],
        'accountUsername' => $r['account_username'],
        'plate' => $r['plate'],
        'vehicle' => $r['vehicle'],
        'driver' => $r['driver'],
        'slot' => $r['slot'],
        'date' => $r['date'],
        'time' => substr($r['time'], 0, 5), // "14:30:00" → "14:30"
        'hours' => (int) $r['hours'],
    ];
}

function map_notification($r)
{
    return [
        'id' => $r['id'],
        'type' => $r['type'],
        'title' => $r['title'],
        'body' => $r['body'],
        'reservationId' => $r['reservation_id'],
        'timestamp' => (int) $r['timestamp'],
        'read' => (bool) $r['read'],
    ];
}

function map_damage_report($r)
{
    return [
        'id' => $r['id'],
        'slotId' => $r['slot_id'],
        'facilityName' => $r['facility_name'],
        'reportedBy' => $r['reported_by'],
        'timestamp' => (int) $r['timestamp'],
        'resolved' => (bool) $r['resolved'],
    ];
}

/** Runs a query and converts every row with $mapper. */
function fetch_mapped($pdo, $sql, $params, $mapper)
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return array_map($mapper, $stmt->fetchAll());
}

/**
 * Builds the whole app state in the same shape store.js keeps in memory.
 * Drivers only receive their own sessions, history, reservations and
 * notifications; staff and the super admin receive everything.
 */
function build_state($pdo, $user)
{
    $username = $user['username'];
    $isDriver = $user['role'] === 'driver';
    $mine = $isDriver ? ' WHERE account_username = ?' : '';
    $mineParams = $isDriver ? [$username] : [];

    $accounts = $user['role'] === 'superadmin'
        ? fetch_mapped($pdo, 'SELECT * FROM accounts ORDER BY created_at', [], 'map_account')
        : [map_account($user)];

    $reservationWhere = $isDriver
        ? " WHERE status = 'pending' AND account_username = ?"
        : " WHERE status = 'pending'";

    $notifications = fetch_mapped(
        $pdo,
        'SELECT * FROM notifications WHERE username = ? ORDER BY timestamp DESC',
        [$username],
        'map_notification'
    );

    // The driver's "My Ticket": their latest reservation they have not cancelled.
    $tickets = [];
    if ($isDriver) {
        $stmt = $pdo->prepare(
            "SELECT * FROM reservations WHERE account_username = ? AND status <> 'cancelled'
             ORDER BY created_at DESC, id DESC LIMIT 1"
        );
        $stmt->execute([$username]);
        $ticket = $stmt->fetch();
        if ($ticket) $tickets[$username] = map_reservation($ticket);
    }

    return [
        'facilities' => fetch_mapped($pdo, 'SELECT * FROM facilities ORDER BY id', [], 'map_facility'),
        'accounts' => $accounts,
        'slots' => fetch_mapped($pdo, 'SELECT * FROM slots ORDER BY id', [], 'map_slot'),
        'sessions' => fetch_mapped($pdo, 'SELECT * FROM sessions' . $mine . ' ORDER BY entry DESC', $mineParams, 'map_session'),
        'history' => fetch_mapped($pdo, 'SELECT * FROM history' . $mine . ' ORDER BY `exit` DESC', $mineParams, 'map_session'),
        'reservations' => fetch_mapped($pdo, 'SELECT * FROM reservations' . $reservationWhere . ' ORDER BY created_at DESC', $mineParams, 'map_reservation'),
        'notifications' => [$username => $notifications],
        'damageReports' => fetch_mapped($pdo, 'SELECT * FROM damage_reports WHERE resolved = 0 ORDER BY timestamp DESC', [], 'map_damage_report'),
        'tickets' => (object) $tickets,
        'firedAlerts' => (object) [],
    ];
}

/** Replies with the fresh state (plus any extra fields) after an action. */
function state_response($pdo, $user, $extra = [])
{
    respond(array_merge($extra, ['state' => build_state($pdo, $user)]));
}

/* ==========================================================================
   Business helpers shared by staff.php, admin.php and driver.php
   ========================================================================== */

/** Short random id like the frontend's uid(), e.g. "a3f9c21b". */
function uid()
{
    return bin2hex(random_bytes(4));
}

/** Milliseconds → "2:30 PM", like clock() in data.js. */
function clock_ms($ms)
{
    return date('g:i A', intdiv((int) $ms, 1000));
}

/** A slot together with its facility name and rates. Locks the row inside a transaction. */
function find_slot($pdo, $slotId)
{
    $stmt = $pdo->prepare(
        'SELECT s.*, f.name AS facility_name, f.rate_per_hour, f.motorcycle_rate
         FROM slots s JOIN facilities f ON f.id = s.facility_id
         WHERE s.id = ? FOR UPDATE'
    );
    $stmt->execute([$slotId]);
    return $stmt->fetch() ?: null;
}

/** Finds a slot and makes sure staff only touch slots in their own facility. */
function require_slot_access($pdo, $user, $slotId)
{
    $slot = find_slot($pdo, $slotId);
    if (!$slot) fail('Slot ' . $slotId . ' does not exist.', 404);
    if ($user['role'] === 'staff' && $slot['facility_id'] !== $user['facility_id']) {
        fail('Slot ' . $slotId . ' belongs to another facility.', 403);
    }
    return $slot;
}

function set_slot($pdo, $slotId, $status, $plate = null)
{
    $pdo->prepare('UPDATE slots SET status = ?, plate = ? WHERE id = ?')->execute([$status, $plate, $slotId]);
}

/** Next ticket number, e.g. "TCK-20511" (continues from active and completed sessions). */
function next_ticket_id($pdo)
{
    $n = $pdo->query(
        'SELECT GREATEST(
            COALESCE((SELECT MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)) FROM sessions), 0),
            COALESCE((SELECT MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)) FROM history), 0),
            20510)'
    )->fetchColumn();
    return 'TCK-' . ((int) $n + 1);
}

function insert_session($pdo, $s)
{
    $pdo->prepare(
        'INSERT INTO sessions (id, account_username, plate, vehicle, driver, slot, entry, duration, reservation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $s['id'],
        $s['account_username'],
        $s['plate'],
        $s['vehicle'],
        $s['driver'],
        $s['slot'],
        $s['entry'],
        $s['duration'],
        $s['reservation_id'],
    ]);
}

/** Same rule as computeFee() in data.js: every started hour is billed, minimum 1 hour. */
function compute_fee($slot, $vehicle, $entryMs, $exitMs)
{
    $hours = max(1, (int) ceil(($exitMs - $entryMs) / 3600000));
    $rate = $vehicle === 'Motorcycle' ? $slot['motorcycle_rate'] : $slot['rate_per_hour'];
    return $hours * (float) $rate;
}

/** Moves an active session into history, charges the fee and frees the slot. */
function close_session($pdo, $session, $exitMs)
{
    $slot = find_slot($pdo, $session['slot']);
    $amount = compute_fee($slot, $session['vehicle'], (int) $session['entry'], $exitMs);

    $pdo->prepare(
        'INSERT INTO history (id, account_username, plate, vehicle, driver, slot, entry, duration, reservation_id, `exit`, amount, paid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
    )->execute([
        $session['id'],
        $session['account_username'],
        $session['plate'],
        $session['vehicle'],
        $session['driver'],
        $session['slot'],
        $session['entry'],
        $session['duration'],
        $session['reservation_id'],
        $exitMs,
        $amount,
    ]);
    $pdo->prepare('DELETE FROM sessions WHERE id = ?')->execute([$session['id']]);
    set_slot($pdo, $session['slot'], 'available');
    return $amount;
}

function push_notification($pdo, $username, $type, $title, $body, $reservationId = null)
{
    $pdo->prepare(
        'INSERT INTO notifications (id, username, type, title, body, reservation_id, timestamp, `read`)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
    )->execute([uid(), $username, $type, $title, $body, $reservationId, now_ms()]);
}
