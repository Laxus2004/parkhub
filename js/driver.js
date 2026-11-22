/* ==========================================================================
   ParkHub — Driver portal (driver.html)
   ========================================================================== */

Store.ready(function () {
  var user = Shell.requireRole("driver");
  if (!user) return;

  var esc = UI.esc;
  var username = user.username;
  var PHOTO_KEY = "parkhub-photo-" + username;
  var $ = function (id) {
    return document.getElementById(id);
  };

  var ui = {
    view: "dashboard",
    facilityId: null,
    modal: null, // 'reserve' | 'extend' | 'cancel'
    reserve: null,
    extend: null,
    prevSessionCount: 0,
  };

  function me() {
    return Store.findAccount(username) || user;
  }

  Shell.init({
    user: user,
    navOpen: false,
    onNavigate: function (next) {
      ui.view = next;
      if (next === "notif") Store.markAllRead(username);
      if (next === "profile") fillProfile();
      render();
    },
  });

  /* ---------- derived data ---------- */
  function data() {
    var s = Store.get();
    var ticket = s.tickets[username] || null;
    if (ticket) {
      ticket =
        s.reservations.find(function (r) {
          return r.id === ticket.id;
        }) || ticket;
    }
    return {
      all: s,
      sessions: s.sessions.filter(function (x) {
        return x.accountUsername === username;
      }),
      reservations: s.reservations.filter(function (r) {
        return r.accountUsername === username;
      }),
      history: s.history.filter(function (h) {
        return h.accountUsername === username;
      }),
      notifications: s.notifications[username] || [],
      ticket: ticket,
    };
  }

  function timing(s, now) {
    if (!s.duration) return null;
    var endMs = s.entry + s.duration * HOUR_MS;
    var minsLeft = Math.max(0, (endMs - now) / MIN_MS);
    var pct = Math.min(100, ((now - s.entry) / (s.duration * HOUR_MS)) * 100);
    var urgent = minsLeft <= 30;
    var critical = minsLeft <= 10;
    return {
      endMs: endMs,
      minsLeft: minsLeft,
      pct: pct,
      urgent: urgent,
      critical: critical,
      bar: critical ? "bar-red" : urgent ? "bar-amber" : "bar-green",
      label: minsLeft < 1 ? "Expiring" : Math.ceil(minsLeft) + "m left",
    };
  }

  function progress(t) {
    return '<div class="progress"><div class="' + t.bar + '" style="width:' + t.pct.toFixed(1) + '%"></div></div>';
  }

  function emptyState(icon, title, sub) {
    return '<div class="empty-state">' + icon + "<p>" + title + '</p><p class="sub">' + sub + "</p></div>";
  }

  var ICON_TICKET =
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="1"/><line x1="2" y1="10" x2="22" y2="10"/></svg>';
  var ICON_PARKING =
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 17V9h4a3 3 0 0 1 0 6H9"/></svg>';

  /* ======================================================================
     Dashboard
     ====================================================================== */
  function renderDashboard(d) {
    $("welcome-sub").textContent = "Welcome, " + me().displayName + " — find and manage your parking.";
    var available = d.all.slots.filter(function (x) {
      return x.status === "available";
    }).length;
    $("dash-stats").innerHTML =
      UI.kpi({ label: "Currently Parked", value: d.sessions.length, gradient: "red", size: "stat" }) +
      UI.kpi({ label: "Available Slots", value: available, gradient: "emerald", size: "stat" }) +
      UI.kpi({ label: "Total Capacity", value: d.all.slots.length, gradient: "blue", size: "stat" });

    $("facility-list").innerHTML = FACILITIES.map(function (f) {
      var open = d.all.slots.filter(function (x) {
        return x.facilityId === f.id && x.status === "available";
      }).length;
      var full = open === 0;
      var pct = Math.round((open / f.total) * 100);
      var tone = full ? "text-red" : pct <= 15 ? "text-amber" : "text-green";
      return (
        '<button type="button" class="facility-card ' +
        (ui.facilityId === f.id ? "is-active" : "") +
        '" data-action="select-facility" data-facility="' +
        f.id +
        '"><div class="facility-card-photo"><img src="' +
        f.photo +
        '" alt="' +
        esc(f.name) +
        '" loading="lazy" /></div><div class="facility-card-body"><div class="facility-card-name"><span>' +
        esc(f.name) +
        '</span><span class="tag-outline">Reservable</span></div><p class="muted" style="font-size:14px;margin-top:4px">' +
        esc(f.address) +
        '</p><div class="facility-card-meta"><span>' +
        f.distanceKm +
        " km away</span><span>" +
        peso(f.ratePerHour) +
        '/h</span></div></div><div class="facility-card-avail"><span class="num ' +
        tone +
        '">' +
        (full ? "FULL" : open) +
        '</span><span class="label" style="font-size:10px;letter-spacing:.05em">' +
        (full ? "no slots" : "open slots") +
        "</span></div></button>"
      );
    }).join("");

    var f = ui.facilityId ? getFacility(ui.facilityId) : null;
    $("facility-detail").innerHTML = f
      ? '<div class="card"><div class="card-head"><h2 class="card-title">Facility Detail</h2></div><div class="facility-photo"><img src="' +
        f.photo +
        '" alt="' +
        esc(f.name) +
        '" /></div><div class="card-body stack-sm"><div><h3 class="display bold" style="font-size:18px;line-height:1.25">' +
        esc(f.name) +
        '</h3><p class="muted" style="font-size:14px">' +
        esc(f.address) +
        '</p></div><dl class="detail-list"><div><dt class="label">Automobile</dt><dd>' +
        peso(f.ratePerHour) +
        '/h</dd></div><div><dt class="label">Motorcycle</dt><dd>' +
        peso(f.motorcycleRate) +
        '/h</dd></div><div class="full"><dt class="label">Hours</dt><dd>' +
        esc(f.open) +
        '</dd></div></dl><a class="btn btn-primary btn-block" style="text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(f.name + ", " + f.address) +
        '">Get Directions</a><button class="btn btn-outline-dark btn-block" data-action="open-reserve">Reserve a Slot</button></div></div>'
      : '<div class="card"><div class="card-head"><h2 class="card-title">Facility Detail</h2></div><p class="muted text-center" style="padding:40px 20px">Select a facility to view rates, hours, and availability.</p></div>';
  }

  /* ======================================================================
     Notifications / My Parking / My Ticket
     ====================================================================== */
  function renderNotifications(d) {
    var list = d.notifications;
    $("notif-list").innerHTML = list.length
      ? '<div class="card-head" style="justify-content:flex-end;padding:8px 16px"><button class="link-btn" style="font-size:10px" data-action="clear-notif">Clear all</button></div>' +
        list
          .map(function (n) {
            return (
              '<div class="notif-item"><div class="notif-title"><span>' +
              esc(n.title) +
              '</span><button class="link-btn" style="font-size:10px" data-action="dismiss-notif" data-id="' +
              n.id +
              '">✕</button></div><p class="notif-body">' +
              esc(n.body) +
              '</p><p class="mono muted" style="font-size:10px;margin-top:6px">' +
              fmtDateTime(n.timestamp) +
              "</p></div>"
            );
          })
          .join("")
      : '<p class="mono muted text-center" style="padding:48px 20px;font-size:12px">No notifications</p>';
  }

  function renderParking(d) {
    $("parking-activity").innerHTML = [
      ["Active Sessions", d.sessions.length],
      ["Active Reservations", d.reservations.length],
      ["Past Sessions", d.history.length],
    ]
      .map(function (r) {
        return '<div><span class="mono muted" style="font-size:11px">' + r[0] + '</span><span class="mono" style="font-size:20px;font-weight:900">' + r[1] + "</span></div>";
      })
      .join("");

    var now = Date.now();
    $("parking-sessions").innerHTML = d.sessions.length
      ? d.sessions
          .map(function (s) {
            var t = timing(s, now);
            var tag = t
              ? '<span class="badge ' + (t.critical ? "badge--solid-red" : t.urgent ? "badge--amber" : "badge--green") + '">' + t.label + "</span>"
              : "";
            return (
              '<div class="session-card"><div class="session-card-head ' +
              (s.reservationId ? "reserved" : "") +
              '"><div><div class="mono bold" style="font-size:12px">' +
              s.id +
              '</div><div class="mono muted" style="font-size:10px">Slot ' +
              s.slot +
              " · " +
              s.vehicle +
              "</div></div>" +
              tag +
              '</div><div class="split-2"><div><div class="label-sm">Entry Time</div><div class="mono bold">' +
              clock(s.entry) +
              '</div></div><div><div class="label-sm">Exit Time</div><div class="mono bold ' +
              (t ? "" : "muted") +
              '">' +
              (t ? clock(t.endMs) : "Open") +
              '</div></div></div><div style="border-top:1px solid var(--line);padding:8px 16px"><span class="label-sm">Plate · </span><span class="mono bold" style="font-size:12px">' +
              esc(s.plate) +
              "</span></div>" +
              (t
                ? '<div class="mono muted" style="display:flex;justify-content:space-between;border-top:1px solid var(--line);padding:8px 16px 4px;font-size:9px"><span>' +
                  clock(s.entry) +
                  "</span><span>" +
                  clock(t.endMs) +
                  "</span></div>" +
                  progress(t) +
                  '<button class="extend-btn ' +
                  (t.urgent ? "urgent" : "") +
                  '" data-action="open-extend" data-id="' +
                  s.id +
                  '">Extend Parking →</button>'
                : "") +
              "</div>"
            );
          })
          .join("")
      : emptyState(ICON_PARKING, "No active parking session.", "Your session appears here once staff approves your arrival.");
  }

  function renderTicket(d) {
    var r = d.ticket;
    if (!r) {
      $("ticket-content").innerHTML = emptyState(ICON_TICKET, "No active reservation ticket.", "Reserve a slot to get your digital ticket here.");
      return;
    }
    var startMs = reservationStartMs(r);
    var endMs = startMs + r.hours * HOUR_MS;
    var fee = reservationFee(r);
    var bars = [3, 5, 2, 7, 4, 6, 2, 5, 3, 4, 6, 3, 5, 2, 4, 7, 3, 5, 2, 6]
      .map(function (h) {
        return '<i style="height:' + h * 3 + 'px"></i>';
      })
      .join("");
    var cells = [
      ["Slot", r.slot],
      ["Plate", r.plate],
      ["Vehicle", r.vehicle],
      ["Driver", r.driver],
      ["Date", fmtISODate(r.date)],
      ["Duration", r.hours + "h"],
    ]
      .map(function (c) {
        return '<div class="cell"><div class="k">' + c[0] + '</div><div class="v">' + esc(c[1]) + "</div></div>";
      })
      .join("");

    $("ticket-content").innerHTML =
      '<div class="res-ticket"><div class="res-ticket-head"><div class="res-ticket-brand"><div class="res-ticket-mark">P</div><div><div class="display bold" style="font-size:11px;letter-spacing:.18em;text-transform:uppercase">ParkHub</div><div class="mono" style="font-size:8px;text-transform:uppercase;opacity:.6">Parking Reservation Ticket</div></div></div><span class="badge badge--solid-green" style="font-size:9px">Paid ✓</span></div>' +
      '<div class="res-ticket-id"><div><div class="k">Reservation ID</div><div class="mono" style="font-size:24px;font-weight:900">' +
      r.id +
      '</div></div><div class="barcode">' +
      bars +
      '</div></div><div class="perforation"><span></span></div><div class="info-grid">' +
      cells +
      '</div><div class="split-2"><div style="padding:8px 12px"><div class="k">Entry</div><div class="mono bold">' +
      clock(startMs) +
      '</div></div><div style="padding:8px 12px"><div class="k">Exit</div><div class="mono bold">' +
      clock(endMs) +
      '</div></div></div><div class="res-ticket-total"><div><div class="k">Amount Paid</div><div class="mono" style="font-size:20px;font-weight:900">' +
      peso(fee) +
      '</div></div><div class="text-right"><div class="k">Rate</div><div class="v">' +
      peso(RATES[r.vehicle]) +
      "/hr × " +
      r.hours +
      'h</div></div></div><div class="res-ticket-foot">Show to staff on arrival</div></div>' +
      '<div class="card" style="border-radius:0;box-shadow:none"><div class="card-body" style="padding:16px 20px"><div style="display:flex;justify-content:space-between;align-items:center;gap:16px"><div><div class="mono bold" style="font-size:11px;text-transform:uppercase">Cancel Reservation</div><div class="mono muted" style="font-size:10px;margin-top:2px">You may cancel your reservation before arrival.</div></div><button class="btn-sm red" data-action="open-cancel">Cancel Reservation</button></div>' +
      '<div class="warn-box" style="margin-top:12px"><span>⚠</span><p>This reservation is <b>NON-REFUNDABLE</b>. Cancelling will forfeit your payment of ' +
      peso(fee) +
      " and release the slot.</p></div></div></div>";
  }

  /* ======================================================================
     Profile
     ====================================================================== */
  function fillProfile() {
    var a = me();
    $("profile-name").value = a.displayName || "";
    $("profile-email").value = a.email || "";
    $("profile-contact").value = a.contact || "";
    $("details-msg").hidden = true;
    $("password-msg").hidden = true;
    renderPhoto();
  }

  function renderPhoto() {
    var photo = localStorage.getItem(PHOTO_KEY);
    var initial = (me().displayName || "?").charAt(0).toUpperCase();
    $("photo-preview").innerHTML = photo ? '<img src="' + photo + '" alt="Profile" />' : initial;
    $("user-avatar").innerHTML = photo ? '<img src="' + photo + '" alt="" />' : initial;
  }

  function showMsg(id, type, textValue) {
    var el = $(id);
    el.className = "msg msg--" + type;
    el.textContent = textValue;
    el.hidden = false;
  }

  $("photo-button").addEventListener("click", function () {
    $("photo-input").click();
  });

  $("photo-input").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        localStorage.setItem(PHOTO_KEY, ev.target.result);
      } catch (err) {
        alert("That image is too large to save. Please choose a smaller photo.");
        return;
      }
      renderPhoto();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  $("profile-contact").addEventListener("input", function (e) {
    e.target.value = e.target.value.replace(/[^\d+\s\-()]/g, "");
  });

  ["profile-name", "profile-email", "profile-contact"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      $("details-msg").hidden = true;
    });
  });
  ["pw-current", "pw-new", "pw-confirm"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      $("password-msg").hidden = true;
    });
  });

  $("details-form").addEventListener("submit", function (e) {
    e.preventDefault();
    Store.updateProfile(username, {
      displayName: $("profile-name").value,
      email: $("profile-email").value,
      contact: $("profile-contact").value,
    }).then(function (error) {
      if (error) return showMsg("details-msg", "error", error);
      showMsg("details-msg", "success", "Personal details updated successfully.");
      Shell.refreshUser(me());
      renderPhoto();
    });
  });

  $("password-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var next = $("pw-new").value;
    if (next !== $("pw-confirm").value) return showMsg("password-msg", "error", "The new passwords do not match.");
    if (next.length < 8 || !/[A-Z]/.test(next) || !/[0-9]/.test(next) || !/[^A-Za-z0-9]/.test(next)) {
      return showMsg("password-msg", "error", "Use at least 8 characters with an uppercase letter, number, and special character.");
    }
    Store.updateProfile(username, { currentPassword: $("pw-current").value, newPassword: next }).then(function (error) {
      if (error) return showMsg("password-msg", "error", error);
      form.reset();
      showMsg("password-msg", "success", "Password changed successfully.");
    });
  });

  /* ======================================================================
     Modals
     ====================================================================== */
  function openReserve() {
    ui.modal = "reserve";
    ui.reserve = {
      step: "map",
      slotId: null,
      plate: "",
      driver: me().displayName,
      vehicle: "Automobile",
      date: "",
      time: "",
      hours: 2,
      gcashRef: "GCX-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
    };
    renderModal();
  }

  function closeModal() {
    ui.modal = null;
    ui.reserve = null;
    ui.extend = null;
    renderModal();
  }

  function reserveEndTime(r) {
    if (!r.time) return null;
    var parts = r.time.split(":").map(Number);
    var end = new Date();
    end.setHours(parts[0], parts[1] + r.hours * 60, 0, 0);
    return clock(end.getTime());
  }

  function modalHead(title, sub, actions) {
    return (
      '<div class="modal-head"><div><div class="card-title">' +
      esc(title) +
      '</div><p class="mono muted" style="font-size:11px;margin-top:2px">' +
      esc(sub) +
      '</p></div><div class="modal-head-actions">' +
      (actions || "") +
      '<button class="link-btn plain" data-action="close-modal">✕ close</button></div></div>'
    );
  }

  function renderReserveModal() {
    var r = ui.reserve;
    var f = getFacility(ui.facilityId);
    var slots = Store.get().slots.filter(function (x) {
      return x.facilityId === f.id;
    });
    var slot = r.slotId ? Store.findSlot(r.slotId) : null;
    var total = RATES[r.vehicle] * r.hours;
    var end = reserveEndTime(r);

    var title = r.step === "map" ? "Select a Slot — " + f.name : r.step === "form" ? "Reservation Details — Slot " + r.slotId : "GCash Advance Payment";
    var sub =
      r.step === "map"
        ? slots.filter(function (x) {
            return x.status === "available";
          }).length + " slots available — green slots are selectable"
        : r.step === "form"
          ? "Fill in your vehicle details, then proceed to payment"
          : "Pay to confirm your reservation — staff will approve your arrival";
    var back =
      r.step === "form"
        ? '<button class="link-btn plain" data-action="reserve-step" data-step="map">← map</button>'
        : r.step === "payment"
          ? '<button class="link-btn plain" data-action="reserve-step" data-step="form">← back</button>'
          : "";

    var order = { map: 0, form: 1, payment: 2 };
    var steps = [
      ["map", "1. Pick Slot"],
      ["form", "2. Details"],
      ["payment", "3. Payment"],
    ]
      .map(function (s) {
        var done = order[s[0]] < order[r.step];
        var active = s[0] === r.step;
        return '<div class="step ' + (active ? "is-active" : done ? "is-done" : "") + '">' + (done ? "✓ " : "") + s[1] + "</div>";
      })
      .join("");

    var body = "";
    if (r.step === "map") {
      var legend = UI.legend(true, "top").replace("Available</span>", "Available — click to select</span>");
      body =
        legend +
        '<div class="slot-grid cols-10-sm">' +
        slots
          .map(function (x) {
            return UI.slotCell(x, { mode: "driver" });
          })
          .join("") +
        "</div>";
    } else if (r.step === "form") {
      body =
        '<form class="modal-pad stack-sm" id="reserve-form" autocomplete="off">' +
        '<div style="display:flex;align-items:center;gap:12px;border:1px solid var(--ink);background:var(--paper);padding:12px 16px">' +
        UI.dot("available") +
        '<div><span class="label">Selected slot</span><div class="mono bold" style="font-size:20px">' +
        r.slotId +
        "</div></div></div>" +
        field("Plate Number", '<input class="input white mono upper" data-r="plate" placeholder="ABC 1234" required value="' + esc(r.plate) + '" />') +
        field("Driver Name", '<input class="input white" data-r="driver" placeholder="Optional" value="' + esc(r.driver) + '" />') +
        field("Date", '<input class="input white mono" type="date" data-r="date" min="' + todayISO() + '" required value="' + r.date + '" />') +
        field("Entry Time", '<input class="input white mono" type="time" data-r="time" required value="' + r.time + '" />') +
        '<div class="field"><span class="label" style="display:block;margin-bottom:6px">Vehicle Type</span><div class="seg">' +
        VEHICLES.map(function (v) {
          var disabled = slot && slot.vehicleType && slot.vehicleType !== v;
          return (
            '<button type="button" style="justify-content:center" data-action="reserve-vehicle" data-vehicle="' +
            v +
            '" class="' +
            (r.vehicle === v ? "is-active" : "") +
            '"' +
            (disabled ? " disabled" : "") +
            ">" +
            v +
            "</button>"
          );
        }).join("") +
        "</div></div>" +
        field(
          "Duration — minimum 2 hours",
          '<input class="input mono" style="padding:12px 16px" type="number" min="2" data-r="hours" value="' +
            r.hours +
            '" placeholder="Enter hours (min 2)" /><p class="field-hint">Enter the number of hours you plan to park (minimum 2).</p>',
        ) +
        '<div id="reserve-summary">' +
        reserveSummary() +
        "</div>" +
        '<div style="border-top:1px solid var(--line);padding-top:8px"><button type="submit" class="btn btn-dark to-gcash btn-block" id="reserve-next">Proceed to GCash Payment →</button></div></form>';
    } else {
      body =
        '<div class="modal-pad stack-sm">' +
        gcashBand(f.name, "Total Due", total) +
        '<div class="info-grid">' +
        UI.infoCell("Slot", r.slotId, { mono: true }) +
        UI.infoCell("Date", fmtISODate(r.date)) +
        UI.infoCell("Entry Time", fmtHHMM(r.time), { mono: true }) +
        UI.infoCell("Plate", r.plate.toUpperCase(), { mono: true, accent: true }) +
        UI.infoCell("Vehicle", r.vehicle) +
        UI.infoCell("Duration", r.hours + " hrs", { mono: true }) +
        UI.infoCell("Rate", peso(RATES[r.vehicle]) + "/hr × " + r.hours + " hrs", { mono: true }) +
        UI.infoCell("End time", end || "—", { mono: true }) +
        "</div>" +
        qrBox(r.gcashRef, total) +
        '<ol class="steps-list"><li>Open your GCash app and tap <strong>Scan QR</strong></li><li>Scan the code above or enter the reference number</li><li>Confirm the amount of <strong>' +
        peso(total) +
        '</strong> and pay</li><li>Tap <strong>"Payment Done"</strong> below to confirm your reservation</li></ol>' +
        '<div style="border-top:1px solid var(--line);padding-top:8px"><button class="btn btn-gcash btn-block" data-action="confirm-reserve">Payment Done — Confirm Reservation</button><p class="mono muted text-center" style="font-size:10px;margin-top:8px">Only click after payment is reflected in your GCash account</p></div></div>';
    }

    return (
      '<div class="modal-backdrop" data-backdrop><div class="modal" role="dialog" aria-modal="true">' +
      modalHead(title, sub, back) +
      '<div class="steps">' +
      steps +
      '</div><div class="modal-body">' +
      body +
      "</div></div></div>"
    );
  }

  function field(label, control) {
    return '<label class="field"><span class="label">' + label + "</span>" + control + "</label>";
  }

  function reserveSummary() {
    var r = ui.reserve;
    return (
      '<div class="price-box"><div class="row"><div><span class="label">Rate · ' +
      r.vehicle +
      '</span><div class="big-mono">' +
      peso(RATES[r.vehicle]) +
      '<span class="muted" style="font-size:14px;font-weight:400">/hr</span></div></div><div><span class="label">Duration</span><div class="big-mono">' +
      r.hours +
      ' hours</div></div></div><div class="total"><div><span class="label">Total payment</span><div class="huge-mono">' +
      peso(RATES[r.vehicle] * r.hours) +
      '</div></div><div class="text-right"><span class="label">End time</span><div class="mono bold muted">' +
      (reserveEndTime(r) || "—") +
      "</div></div></div></div>"
    );
  }

  function syncReserveForm() {
    var r = ui.reserve;
    $("reserve-summary").innerHTML = reserveSummary();
    $("reserve-next").disabled = !r.plate.trim() || !r.date || !r.time;
  }

  function gcashBand(subtitle, dueLabel, amount) {
    return (
      '<div class="gcash-band"><div><div class="brand">GCash</div><div class="small">' +
      esc(subtitle) +
      '</div></div><div class="text-right"><div class="small">' +
      dueLabel +
      '</div><div class="amount">' +
      peso(amount) +
      "</div></div></div>"
    );
  }

  function qrBox(ref, amount) {
    return (
      '<div class="qr-box">' +
      UI.qr(ref, amount) +
      '<div class="label" style="letter-spacing:.05em">Scan with GCash app to pay</div><div class="mono muted" style="font-size:12px">Ref: <span style="color:var(--ink);font-weight:500">' +
      ref +
      "</span></div></div>"
    );
  }

  function renderExtendModal() {
    var x = ui.extend;
    var s = Store.get().sessions.find(function (item) {
      return item.id === x.sessionId;
    });
    if (!s) {
      ui.modal = null;
      return "";
    }
    var curEnd = s.entry + (s.duration || 0) * HOUR_MS;
    var newEnd = s.entry + ((s.duration || 0) + x.hours) * HOUR_MS;
    var amount = RATES[s.vehicle] * x.hours;
    var ref = "GCX-EXT-" + s.id.slice(-5) + x.hours;
    var body;
    if (x.step === "pick") {
      body =
        '<div class="modal-pad stack-sm"><div class="info-grid">' +
        UI.infoCell("Current expiry", clock(curEnd), { mono: true }) +
        UI.infoCell("New expiry", clock(newEnd), { mono: true, accent: true }) +
        '</div><div class="field"><span class="field-label" style="display:block;margin-bottom:8px">Extend by</span><div class="seg cols-4 center">' +
        [1, 2, 3, 4]
          .map(function (h) {
            return '<button type="button" style="padding:12px" data-action="extend-hours" data-hours="' + h + '" class="' + (x.hours === h ? "is-active" : "") + '">+' + h + "h</button>";
          })
          .join("") +
        '</div></div><div style="display:flex;justify-content:space-between;align-items:center;border:1px solid var(--line);background:var(--paper);padding:12px 16px"><div><span class="field-label">Extension fee</span><div class="huge-mono">' +
        peso(amount) +
        '</div></div><span class="mono muted" style="font-size:11px">' +
        peso(RATES[s.vehicle]) +
        "/h × " +
        x.hours +
        'h · via GCash</span></div><button class="btn btn-dark to-gcash btn-block" data-action="extend-step" data-step="payment">Proceed to GCash Payment →</button></div>';
    } else {
      body =
        '<div class="modal-pad stack-sm">' +
        gcashBand("Parking Extension · " + s.id, "Amount Due", amount) +
        '<div class="info-grid">' +
        UI.infoCell("Slot", s.slot, { mono: true }) +
        UI.infoCell("Extension", "+" + x.hours + "h", { mono: true, accent: true }) +
        UI.infoCell("New expiry", clock(newEnd)) +
        UI.infoCell("Fee", peso(RATES[s.vehicle]) + "/h × " + x.hours + "h", { mono: true }) +
        "</div>" +
        qrBox(ref, amount) +
        '<ol class="steps-list"><li>Open your GCash app and tap <strong>Scan QR</strong></li><li>Confirm ' +
        peso(amount) +
        ' and complete payment</li><li>Tap <strong>"Payment Done"</strong> below to apply the extension</li></ol><button class="btn btn-gcash btn-block" data-action="confirm-extend">Payment Done — Apply Extension</button><p class="mono muted text-center" style="font-size:10px">Only click after payment is reflected in your GCash account</p></div>';
    }
    return (
      '<div class="modal-backdrop" data-backdrop><div class="modal sm" role="dialog" aria-modal="true">' +
      modalHead(x.step === "pick" ? "Extend Parking — " + s.id : "GCash Extension Payment", "Slot " + s.slot + " · " + s.vehicle + " · " + s.plate) +
      '<div class="modal-body">' +
      body +
      "</div></div></div>"
    );
  }

  function renderCancelModal() {
    var r = data().ticket;
    if (!r) {
      ui.modal = null;
      return "";
    }
    var fee = peso(reservationFee(r));
    return (
      '<div class="modal-backdrop" data-backdrop style="align-items:center"><div class="modal xs" role="dialog" aria-modal="true"><div class="modal-head danger"><div class="card-title" style="letter-spacing:.04em">Confirm Cancellation</div></div><div class="modal-pad stack-sm" style="padding:20px">' +
      '<div style="border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.05);padding:12px 16px"><p class="mono bold text-red" style="font-size:11px;text-transform:uppercase">⚠ Non-Refundable Payment</p><p class="mono muted" style="font-size:11px;margin-top:4px;line-height:1.6">Your payment of <b style="color:var(--ink)">' +
      fee +
      '</b> will not be returned. This action cannot be undone.</p></div><div class="info-grid">' +
      [
        ["Reservation", r.id],
        ["Slot", r.slot],
        ["Plate", r.plate],
        ["Amount Forfeited", fee],
      ]
        .map(function (c) {
          return '<div class="info-cell" style="padding:8px 12px"><div class="label-sm">' + c[0] + '</div><div class="mono bold" style="font-size:12px">' + esc(c[1]) + "</div></div>";
        })
        .join("") +
      '</div><div style="display:flex;gap:12px"><button class="btn-sm" style="flex:1;padding:10px;border-color:var(--line);color:var(--ink-soft)" data-action="close-modal">Keep Reservation</button><button class="btn-sm solid-dark to-red" style="flex:1;padding:10px;background:var(--signal);border-color:var(--signal)" data-action="confirm-cancel">Yes, Cancel</button></div></div></div></div>'
    );
  }

  function renderModal() {
    var html = "";
    if (ui.modal === "reserve") html = renderReserveModal();
    else if (ui.modal === "extend") html = renderExtendModal();
    else if (ui.modal === "cancel") html = renderCancelModal();
    $("modal-root").innerHTML = html;
    if (ui.modal === "reserve" && ui.reserve.step === "form") syncReserveForm();
  }

  /* ======================================================================
     Render
     ====================================================================== */
  function render() {
    var d = data();

    // Jump to My Parking when staff approves an arrival (a new session appears).
    if (d.sessions.length > ui.prevSessionCount && d.sessions.length > 0) {
      ui.view = "parking";
      Shell.show("parking");
    }
    ui.prevSessionCount = d.sessions.length;

    var unread = d.notifications.filter(function (n) {
      return !n.read;
    }).length;
    UI.setNavBadge("badge-notif", unread ? (unread > 9 ? "9+" : String(unread)) : "");
    UI.setNavBadge("badge-parking", d.sessions.length ? String(d.sessions.length) : "");
    UI.setNavBadge("badge-ticket", d.ticket ? "1" : "");

    if (ui.view === "dashboard") renderDashboard(d);
    else if (ui.view === "notif") renderNotifications(d);
    else if (ui.view === "parking") renderParking(d);
    else if (ui.view === "ticket") renderTicket(d);

    // Keep the slot picker live if another tab changes availability.
    if (ui.modal === "reserve" && ui.reserve.step === "map") renderModal();
  }

  /* ======================================================================
     Events
     ====================================================================== */
  document.addEventListener("click", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-backdrop")) return closeModal();
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");
    var r = ui.reserve;

    switch (action) {
      case "select-facility":
        ui.facilityId = el.getAttribute("data-facility");
        render();
        break;
      case "open-reserve":
        openReserve();
        break;
      case "close-modal":
        closeModal();
        break;
      case "pick-slot":
        var slot = Store.findSlot(el.getAttribute("data-slot"));
        if (!slot || slot.status !== "available") return;
        r.slotId = slot.id;
        if (slot.vehicleType) r.vehicle = slot.vehicleType;
        r.step = "form";
        renderModal();
        break;
      case "reserve-step":
        r.step = el.getAttribute("data-step");
        renderModal();
        break;
      case "reserve-vehicle":
        r.vehicle = el.getAttribute("data-vehicle");
        renderModal();
        break;
      case "confirm-reserve":
        var picked = Store.findSlot(r.slotId);
        if (!picked || picked.status !== "available") {
          alert("Sorry, slot " + r.slotId + " was just taken. Please pick another slot.");
          r.step = "map";
          renderModal();
          return;
        }
        var payload = { slotId: r.slotId, plate: r.plate, driver: r.driver, vehicle: r.vehicle, date: r.date, time: r.time, hours: r.hours };
        closeModal();
        ui.view = "ticket";
        Shell.show("ticket");
        Store.createReservation(username, payload);
        break;
      case "open-extend":
        ui.modal = "extend";
        ui.extend = { sessionId: el.getAttribute("data-id"), hours: 1, step: "pick" };
        renderModal();
        break;
      case "extend-hours":
        ui.extend.hours = +el.getAttribute("data-hours");
        renderModal();
        break;
      case "extend-step":
        ui.extend.step = el.getAttribute("data-step");
        renderModal();
        break;
      case "confirm-extend":
        var ext = ui.extend;
        closeModal();
        Store.extendSession(username, ext.sessionId, ext.hours);
        break;
      case "open-cancel":
        ui.modal = "cancel";
        renderModal();
        break;
      case "confirm-cancel":
        var ticket = data().ticket;
        closeModal();
        ui.view = "dashboard";
        Shell.show("dashboard");
        if (ticket) Store.driverCancelReservation(username, ticket.id);
        break;
      case "dismiss-notif":
        Store.dismissNotification(username, el.getAttribute("data-id"));
        break;
      case "clear-notif":
        Store.clearNotifications(username);
        break;
    }
  });

  // Reservation form inputs update state without re-rendering (keeps focus).
  document.addEventListener("input", function (e) {
    var key = e.target.getAttribute && e.target.getAttribute("data-r");
    if (!key || !ui.reserve) return;
    if (key === "hours") {
      var v = parseInt(e.target.value, 10);
      ui.reserve.hours = isNaN(v) || v < 2 ? 2 : v;
    } else {
      ui.reserve[key] = e.target.value;
    }
    syncReserveForm();
  });

  document.addEventListener("change", function (e) {
    if (e.target.getAttribute && e.target.getAttribute("data-r") === "hours" && ui.reserve) {
      e.target.value = ui.reserve.hours;
    }
  });

  document.addEventListener("submit", function (e) {
    if (e.target.id !== "reserve-form") return;
    e.preventDefault();
    if (!ui.reserve.slotId || !ui.reserve.plate.trim()) return;
    ui.reserve.step = "payment";
    renderModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && ui.modal) closeModal();
  });

  /* ---------- start ---------- */
  ui.prevSessionCount = data().sessions.length;
  renderPhoto();
  Store.subscribe(render);
  render();

  Store.runDriverAlerts(username);
  setInterval(function () {
    Store.runDriverAlerts(username);
  }, 30000);

  // Refresh countdowns and progress bars.
  setInterval(function () {
    if (ui.view === "dashboard" || ui.view === "parking") render();
  }, 10000);
});
