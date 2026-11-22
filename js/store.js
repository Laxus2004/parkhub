/* ==========================================================================
   ParkHub — Application state ("store"), connected to the PHP backend

   The database (via api/*.php) is the source of truth. This file keeps a
   copy of the latest state in memory so pages can read it instantly with
   Store.get(), and refreshes it:
     • after every action (each PHP action replies with the fresh state)
     • every few seconds, so staff, driver and admin pages stay in sync.

   Actions return Promises because they wait for the server.
   ========================================================================== */

var Store = (function () {
  var API = "api/";
  var USER_KEY = "parkhub-current-user"; // cached copy of the signed-in account
  var POLL_MS = 5000;
  var listeners = [];
  var state = emptyState();
  var polling = null;

  // Data from the old browser-only version is no longer used.
  localStorage.removeItem("parkhub-state-v1");

  function emptyState() {
    return {
      facilities: [],
      accounts: [],
      slots: [],
      sessions: [], // active parking sessions
      history: [], // completed parking sessions
      reservations: [], // pending reservations
      notifications: {}, // { username: [notification] }
      damageReports: [],
      tickets: {}, // { username: reservation shown on the driver's "My Ticket" }
      firedAlerts: {},
    };
  }

  function emit() {
    listeners.forEach(function (fn) {
      fn(state);
    });
  }

  /* ---------- talking to PHP ---------- */

  /** GET when body is omitted, otherwise POST JSON. Always resolves to an object; failures carry `error`. */
  function request(file, body) {
    var opts = { credentials: "same-origin" };
    if (body) {
      opts.method = "POST";
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }
    return fetch(API + file, opts).then(
      function (res) {
        return res
          .json()
          .catch(function () {
            return { error: "The server sent an invalid response (" + res.status + ")." };
          })
          .then(function (data) {
            data._status = res.status;
            if (!res.ok && !data.error) data.error = "Request failed (" + res.status + ").";
            // Session expired or never signed in: go back to the sign-in page.
            if (res.status === 401 && file !== "auth.php") signedOut();
            return data;
          });
      },
      function () {
        return { error: "Cannot reach the server. Make sure Apache and MySQL are running in XAMPP." };
      }
    );
  }

  function signedOut() {
    localStorage.removeItem(USER_KEY);
    if (polling) clearInterval(polling);
    var page = location.pathname.split("/").pop();
    if (page && page !== "index.html") location.replace("index.html");
  }

  function setState(next) {
    var changed = JSON.stringify(next) !== JSON.stringify(state);
    state = next;
    var me = currentUser();
    var fresh = me && findAccount(me.username);
    if (fresh) cacheUser(fresh);
    if (changed) emit();
  }

  function refresh() {
    return request("state.php").then(function (data) {
      if (!data.error) {
        delete data._status;
        setState(data);
      }
      return data;
    });
  }

  /**
   * Runs one action on the server, then updates the state from its reply.
   * Resolves to the full reply, or null when it failed (the error is shown).
   */
  function act(file, action, fields) {
    return request(file, Object.assign({ action: action }, fields || {})).then(function (data) {
      if (data.error) {
        if (data._status !== 401) alert(data.error);
        refresh();
        return null;
      }
      if (data.state) setState(data.state);
      return data;
    });
  }

  /**
   * Dashboard pages start with Store.ready(function () { ... }) so they only
   * render once the first state has arrived from the server.
   */
  function ready(fn) {
    if (!currentUser()) {
      location.replace("index.html");
      return;
    }
    refresh().then(function (data) {
      if (data.error) {
        if (currentUser()) alert(data.error);
        return;
      }
      fn();
      if (!polling) polling = setInterval(refresh, POLL_MS);
    });
  }

  /* ---------- small lookups ---------- */

  function findSlot(id) {
    return state.slots.find(function (s) {
      return s.id === id;
    });
  }

  function findAccount(username) {
    return state.accounts.find(function (a) {
      return a.username === username;
    });
  }

  /* ======================================================================
     Actions
     ====================================================================== */

  /* ---------- Authentication ---------- */

  /** Resolves to { account } or { error }. */
  function login(usernameOrEmail, password) {
    return request("auth.php", { action: "login", username: usernameOrEmail, password: password }).then(function (data) {
      if (data.account) cacheUser(data.account);
      return data;
    });
  }

  /** Resolves to { displayName } or { error }. */
  function register(data) {
    return request("auth.php", Object.assign({ action: "register" }, data));
  }

  function cacheUser(account) {
    localStorage.setItem(USER_KEY, JSON.stringify(account));
  }

  function currentUser() {
    try {
      var account = JSON.parse(localStorage.getItem(USER_KEY));
      return account && typeof account === "object" ? account : null;
    } catch (e) {
      return null; // old format from the browser-only version
    }
  }

  function logout() {
    localStorage.removeItem(USER_KEY);
    if (polling) clearInterval(polling);
    return request("auth.php", { action: "logout" });
  }

  /** Resolves to an error message, or null when saved. */
  function updateProfile(username, updates) {
    return request("account.php", Object.assign({ action: "update_profile" }, updates)).then(function (data) {
      if (data.error) return data.error;
      cacheUser(data.account);
      setState(data.state);
      return null;
    });
  }

  /* ---------- Notifications ---------- */

  function markAllRead() {
    return act("account.php", "mark_all_read");
  }

  function dismissNotification(username, id) {
    return act("account.php", "dismiss", { id: id });
  }

  function clearNotifications() {
    return act("account.php", "clear");
  }

  /* ---------- Staff: entries, exits, reservations ---------- */

  /** Resolves to the new session (for the printed ticket), or null. */
  function recordEntry(data) {
    return act("staff.php", "entry", data).then(function (res) {
      return res && res.session;
    });
  }

  function recordExit(sessionId) {
    return act("staff.php", "exit", { sessionId: sessionId });
  }

  function approveReservation(reservationId) {
    return act("staff.php", "approve", { reservationId: reservationId });
  }

  function cancelReservation(reservationId) {
    return act("staff.php", "cancel", { reservationId: reservationId });
  }

  function extendReservation(reservationId, extraHours) {
    return act("staff.php", "extend", { reservationId: reservationId, hours: extraHours });
  }

  /* ---------- Damage reports / out of service ---------- */

  function addDamageReport(slotId) {
    return act("staff.php", "damage", { slotId: slotId });
  }

  function markOutOfService(slotId) {
    return act("admin.php", "out_of_service", { slotId: slotId });
  }

  function resolveDamageReport(reportId) {
    return act("admin.php", "resolve", { reportId: reportId });
  }

  /* ---------- Driver: reservations & extensions ---------- */

  function createReservation(username, data) {
    return act("driver.php", "reserve", data);
  }

  function driverCancelReservation(username, reservationId) {
    return act("driver.php", "cancel", { reservationId: reservationId });
  }

  function extendSession(username, sessionId, extraHours) {
    return act("driver.php", "extend", { sessionId: sessionId, hours: extraHours });
  }

  /**
   * Runs the server reminder engine. Failures stay silent because this runs
   * automatically every 30 seconds; the normal 5-second refresh still works.
   */
  function runDriverAlerts() {
    return request("alerts.php", { action: "run" }).then(function (data) {
      if (!data.error && data.state) setState(data.state);
      return data;
    });
  }

  /** Clears all parking data back to the seed (Super Admin → Reports). */
  function reset() {
    return act("admin.php", "reset");
  }

  return {
    get: function () {
      return state;
    },
    subscribe: function (fn) {
      listeners.push(fn);
    },
    ready: ready,
    refresh: refresh,
    findSlot: findSlot,
    findAccount: findAccount,
    login: login,
    register: register,
    currentUser: currentUser,
    logout: logout,
    updateProfile: updateProfile,
    markAllRead: markAllRead,
    dismissNotification: dismissNotification,
    clearNotifications: clearNotifications,
    recordEntry: recordEntry,
    recordExit: recordExit,
    approveReservation: approveReservation,
    cancelReservation: cancelReservation,
    extendReservation: extendReservation,
    addDamageReport: addDamageReport,
    markOutOfService: markOutOfService,
    resolveDamageReport: resolveDamageReport,
    createReservation: createReservation,
    driverCancelReservation: driverCancelReservation,
    extendSession: extendSession,
    runDriverAlerts: runDriverAlerts,
    reset: reset,
  };
})();
