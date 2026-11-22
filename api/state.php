<?php
/* ==========================================================================
   GET api/state.php → the whole app state for the signed-in user.
   ========================================================================== */

require_once __DIR__ . '/config.php';

$user = require_user($pdo);
respond(build_state($pdo, $user));
