/* ==========================================================================
   ParkHub — Staff dashboard (staff.html)
   ========================================================================== */

Store.ready(function () {
  var user = Shell.requireRole("staff");
  if (!user) return;

  var esc = UI.esc;
  var td = UI.td;
  var $ = function (id) {
    return document.getElementById(id);
  };

  /* ---------- page state ---------- */
  var ui = {
    view: "facility",
    facilityId: user.facilityId || FACILITIES[0].id,
    locked: !!user.facilityId,
    zone: "ALL",
    vehicle: "Automobile",
    manualSlotId: null,
    selectedSlotId: null,
    extending: false,
    extendHours: 1,
    ticket: null,
    alerts: [], // reservations arriving within 30 seconds
    firedAlerts: {},
  };

  Shell.init({
    user: user,
    navOpen: false,
    onNavigate: function (next) {
      ui.view = next;
      render();
    },
  });

  $("welcome-sub").textContent = "Welcome back, " + user.displayName + " — here is today's parking overview.";
  $("rate-auto").textContent = peso(RATES.Automobile);
  $("rate-moto").textContent = peso(RATES.Motorcycle);

  /* ---------- derived data ---------- */
  function scope() {
    var s = Store.get();
    var slotFacility = {};
    s.slots.forEach(function (slot) {
      slotFacility[slot.id] = slot.facilityId;
    });
    var mine = function (slotId) {
      return slotFacility[slotId] === ui.facilityId;
    };
    var slots = s.slots.filter(function (x) {
      return x.facilityId === ui.facilityId;
    });
    var sessions = s.sessions.filter(function (x) {
      return mine(x.slot);
    });
    var counts = { available: 0, occupied: 0, reserved: 0, out_of_service: 0 };
    slots.forEach(function (x) {
      counts[x.status] += 1;
    });
    return {
      all: s,
      facility: getFacility(ui.facilityId),
      slots: slots,
      sessions: sessions,
      walkIns: sessions.filter(function (x) {
        return !x.reservationId;
      }),
      reservationSessions: sessions.filter(function (x) {
        return !!x.reservationId;
      }),
      reservations: s.reservations.filter(function (x) {
        return mine(x.slot);
      }),
      history: s.history.filter(function (x) {
        return mine(x.slot);
      }),
      counts: counts,
    };
  }

  /** Manual slot if chosen, otherwise the first free slot that fits the vehicle type. */
  function assignableSlot(d) {
    var fits = function (x) {
      return x.status === "available" && (!x.vehicleType || x.vehicleType === ui.vehicle);
    };
    if (ui.manualSlotId) {
      return d.slots.find(function (x) {
        return x.id === ui.manualSlotId && fits(x);
      });
    }
    return d.slots.find(fits);
  }

  function kpi(label, value, sub, accent) {
    var gradient =
      accent === "signal" ? "red" : accent === "available" ? "emerald" : accent === "violet" ? "violet" : label.indexOf("Revenue") !== -1 ? "violet" : "blue";
    return UI.kpi({ label: label, value: value, sub: sub, gradient: gradient, size: "lg" });
  }

  function liveTotal(list, now) {
    return list.reduce(function (sum, x) {
      return sum + computeFee(x.vehicle, x.entry, now);
    }, 0);
  }

  function occupiedCount(list, d) {
    return list.filter(function (x) {
      return d.slots.some(function (slot) {
        return slot.id === x.slot && slot.status === "occupied";
      });
    }).length;
  }

  function dueTimeLabel(ms) {
    return clock(ms) + " · " + fmtDateShort(ms);
  }

  /* ---------- Dashboard ---------- */
  function renderFacility(d) {
    var f = d.facility;
    $("facility-select").innerHTML = ui.locked
      ? '<div class="facility-banner"><div class="facility-banner-name">' +
        esc(f.name) +
        '</div><div class="facility-banner-meta">' +
        f.zones.length +
        " zones · " +
        f.total +
        " slots · Assigned facility</div></div>"
      : '<div class="facility-tabs">' + UI.facilityTabs(ui.facilityId) + "</div>";

    var occPct = d.slots.length ? Math.round((d.counts.occupied / d.slots.length) * 100) : 0;
    var paid = d.history.filter(function (h) {
      return h.paid;
    });
    var revenue = paid.reduce(function (sum, h) {
      return sum + (h.amount || 0);
    }, 0);
    $("facility-kpis").innerHTML =
      kpi("Total Slots", d.slots.length, f.zones.length + " zones · " + f.zones.join("–")) +
      kpi("Available Now", d.counts.available, d.counts.reserved + " reserved", "available") +
      kpi("Occupancy", occPct + "%", d.counts.occupied + " vehicles parked", "signal") +
      kpi("Revenue Today", peso(revenue), paid.length + " paid transactions");

    var manual = ui.manualSlotId ? Store.findSlot(ui.manualSlotId) : null;
    $("entry-vehicle").innerHTML = VEHICLES.map(function (v) {
      var disabled = manual && manual.vehicleType && manual.vehicleType !== v;
      return (
        '<button type="button" data-action="vehicle" data-vehicle="' +
        v +
        '" class="' +
        (ui.vehicle === v ? "is-active" : "") +
        '"' +
        (disabled ? " disabled" : "") +
        "><span>" +
        v +
        '</span><span class="seg-rate">' +
        peso(RATES[v]) +
        "/h</span></button>"
      );
    }).join("");

    var slot = assignableSlot(d);
    $("entry-slot").innerHTML = manual
      ? '<div class="slot-pick-box manual"><div><span class="label">Manual slot selected</span><div class="slot-pick-id">' +
        manual.id +
        '</div></div><button type="button" class="link-btn" data-action="clear-manual">✕ use auto</button></div>'
      : '<div class="slot-pick-box"><div><span class="label">Auto-assigned slot</span><div class="slot-pick-id">' +
        (slot ? slot.id : "FULL") +
        '</div></div><span class="mono muted" style="font-size: 11px">or pick a slot on the map</span></div>';
    syncEntryButton(d);

    var t = ui.ticket;
    $("ticket-box").innerHTML = t
      ? '<div class="ticket"><div class="ticket-head"><span class="card-title">Digital Ticket</span><button class="link-btn plain" data-action="dismiss-ticket">✕ dismiss</button></div>' +
        '<div class="card-body"><div class="ticket-id">' +
        t.id +
        '</div><div class="ticket-rows">' +
        [
          ["Plate", t.plate],
          ["Vehicle", t.vehicle],
          ["Slot", t.slot],
          ["Entry", clock(t.entry)],
        ]
          .map(function (r) {
            return '<div><span class="label">' + r[0] + '</span><div class="v">' + esc(r[1]) + "</div></div>";
          })
          .join("") +
        '</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid var(--line)"><span class="muted" style="font-size:12px">Driver</span><span style="font-weight:500">' +
        esc(t.driver) +
        "</span></div></div></div>"
      : "";
  }

  function syncEntryButton(d) {
    $("entry-submit").disabled = !assignableSlot(d || scope()) || !$("entry-plate").value.trim();
  }

  /* ---------- Slot map ---------- */
  function renderMap(d) {
    $("map-zones").innerHTML = UI.zoneChips(d.facility.zones, ui.zone);
    var shown = ui.zone === "ALL" ? d.slots : d.slots.filter(function (x) {
      return x.zone === ui.zone;
    });
    $("map-grid").innerHTML = shown
      .map(function (slot) {
        return UI.slotCell(slot, {
          mode: "staff",
          selected: ui.selectedSlotId === slot.id,
          fromReservation: d.all.sessions.some(function (x) {
            return x.slot === slot.id && !!x.reservationId;
          }),
        });
      })
      .join("");
    $("map-legend").innerHTML = UI.legend(true);
    $("slot-detail").innerHTML = ui.selectedSlotId ? slotDetail(d) : "";
  }

  function slotDetail(d) {
    var slot = Store.findSlot(ui.selectedSlotId);
    if (!slot) return "";
    var now = Date.now();
    var sess =
      slot.status === "occupied"
        ? d.all.sessions.find(function (x) {
            return x.slot === slot.id;
          })
        : null;
    var head =
      '<div class="slot-detail-head"><div class="slot-detail-title"><span class="mono bold" style="font-size:16px">' +
      slot.id +
      "</span>" +
      UI.dot(slot.status) +
      '<span class="label" style="letter-spacing:.05em">' +
      UI.STATUS_LABEL[slot.status] +
      "</span>" +
      (slot.isPwd ? '<span class="badge badge--outline-pwd">PWD</span>' : "") +
      '</div><div style="display:flex;gap:12px;align-items:center">' +
      (slot.status !== "out_of_service"
        ? '<button class="link-btn warn" data-action="report-damage" title="Report this slot as damaged — notifies the administrator">⚠ Report Damage</button>'
        : "") +
      (sess
        ? '<button class="btn-sm to-red" style="padding:8px 16px" data-action="checkout" data-id="' +
          sess.id +
          '">Check-out</button>'
        : "") +
      '<button class="link-btn plain" data-action="close-detail">✕ close</button></div></div>';

    var body;
    if (slot.status === "occupied") {
      var dueMs = sess && sess.duration ? sess.entry + sess.duration * HOUR_MS : null;
      body = sess
        ? '<div class="info-grid cols-4">' +
          UI.infoCell("Ticket ID", sess.id, { mono: true, lg: true }) +
          UI.infoCell("Plate No.", sess.plate, { mono: true, accent: true, lg: true }) +
          UI.infoCell("Vehicle Type", sess.vehicle, { lg: true }) +
          UI.infoCell("Driver", sess.driver, { lg: true }) +
          UI.infoCell("Entry Time", clock(sess.entry), { mono: true, lg: true }) +
          UI.infoCell("Due / Exit Time", dueMs ? dueTimeLabel(dueMs) + (now >= dueMs ? " · OVERDUE" : "") : "Open Time", { mono: true, lg: true }) +
          UI.infoCell("Duration", durationLabel(sess.entry, now), { mono: true, lg: true }) +
          UI.infoCell("Running Fee", peso(computeFee(sess.vehicle, sess.entry, now)), { mono: true, accent: true, lg: true }) +
          "</div>"
        : messageRow("!", "No active session found", "Slot marked occupied but no session record linked.");
    } else if (slot.status === "reserved") {
      var res = d.all.reservations.find(function (r) {
        return r.slot === slot.id;
      });
      body = res ? reservationDetail(res) : '<div class="card-body text-center"><div class="mono muted bold">RESERVED SLOT</div><p class="muted" style="font-size:12px;margin-top:4px">No reservation record linked to this slot.</p></div>';
    } else if (slot.status === "out_of_service") {
      body = messageRow("!", "Slot Out of Service", "This slot is currently unavailable. Contact the administrator to restore it.", "gray");
    } else {
      body =
        '<div class="slot-detail-msg"><div class="lead"><div class="circle-icon green">✓</div><div><div class="mono" style="font-weight:500">Slot ' +
        slot.id +
        ' — Available</div><p class="muted" style="font-size:12px">Empty. Assign a vehicle here.</p></div></div><button class="btn-sm solid-dark" style="padding:8px 16px" data-action="assign">Assign vehicle →</button></div>';
    }
    return '<div class="slot-detail">' + head + body + "</div>";
  }

  function messageRow(icon, title, sub, tone) {
    return (
      '<div class="slot-detail-msg" style="justify-content:flex-start"><div class="circle-icon ' +
      (tone || "") +
      '">' +
      icon +
      '</div><div><div class="mono" style="font-weight:500;text-transform:uppercase">' +
      title +
      '</div><p class="muted" style="font-size:12px;margin-top:4px">' +
      sub +
      "</p></div></div>"
    );
  }

  function reservationDetail(res) {
    var startMs = reservationStartMs(res);
    var endMs = startMs + res.hours * HOUR_MS;
    var html =
      '<div class="info-grid cols-4">' +
      UI.infoCell("Reservation ID", res.id, { mono: true, lg: true }) +
      UI.infoCell("Plate No.", res.plate, { mono: true, accent: true, lg: true }) +
      UI.infoCell("Vehicle Type", res.vehicle, { lg: true }) +
      UI.infoCell("Driver", res.driver, { lg: true }) +
      UI.infoCell("Date", fmtISODate(res.date), { mono: true, lg: true }) +
      UI.infoCell("Arrival Time", fmtHHMM(res.time), { mono: true, lg: true }) +
      UI.infoCell("Duration", res.hours + "h", { mono: true, lg: true }) +
      '<div class="info-cell lg"><span class="label">Total Paid</span><div style="display:flex;align-items:center;gap:8px;margin-top:2px"><span class="mono bold">' +
      peso(reservationFee(res)) +
      '</span><span class="badge badge--solid-green" style="font-size:9px">Paid ✓</span></div></div>' +
      '<div class="exit-strip span-all"><div><span class="label">Exit Time</span><div class="mono bold" style="font-size:20px">' +
      clock(endMs) +
      ' <span class="muted" style="font-size:14px;font-weight:400">· ' +
      fmtDateShort(endMs) +
      '</span></div></div><span class="mono muted" style="font-size:10px">Entry ' +
      fmtHHMM(res.time) +
      " + " +
      res.hours +
      "h</span></div>";

    if (ui.extending) {
      var fee = RATES[res.vehicle] * ui.extendHours;
      html +=
        '<div class="extend-box span-all"><div class="card-head"><span class="mono bold" style="font-size:11px;text-transform:uppercase">Extend Reservation — ' +
        res.id +
        '</span><button class="link-btn plain" data-action="extend-toggle">✕ cancel</button></div><div class="card-body stack-sm"><div><span class="label">Additional hours</span><div class="seg cols-4 center" style="margin-top:8px">' +
        [1, 2, 3, 4]
          .map(function (h) {
            return '<button type="button" data-action="extend-hours" data-hours="' + h + '" class="' + (ui.extendHours === h ? "is-active" : "") + '">+' + h + "h</button>";
          })
          .join("") +
        '</div></div><div class="info-grid"><div class="info-cell"><span class="label">New duration</span><div class="big-mono">' +
        (res.hours + ui.extendHours) +
        'h total</div></div><div class="info-cell"><span class="label">Extension fee</span><div class="big-mono text-green">' +
        peso(fee) +
        '</div></div></div><p class="mono muted" style="font-size:10px">Collect ' +
        peso(fee) +
        ' cash from the driver before approving.</p><button class="btn btn-dark to-green btn-block" data-action="extend-confirm" data-id="' +
        res.id +
        '">✓ Confirm Extension — Payment Received</button></div></div>';
    }

    html +=
      '<div class="action-bar span-all"><button class="btn-sm lg solid-green" data-action="approve" data-id="' +
      res.id +
      '">✓ Approve — Customer Arrived</button><button class="btn-sm lg" data-action="extend-toggle">↑ Extend Time</button><button class="btn-sm lg red" data-action="cancel-res" data-id="' +
      res.id +
      '">Cancel</button></div></div>';
    return html;
  }

  /* ---------- Sessions & walk-ins ---------- */
  function filterSessions(list, q) {
    q = q.trim().toLowerCase();
    if (!q) return list;
    return list.filter(function (x) {
      return [x.id, x.plate, x.driver, x.vehicle].some(function (v) {
        return v.toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  function renderSessions(d) {
    var now = Date.now();
    $("sessions-kpis").innerHTML =
      kpi("Active Reservation Sessions", d.reservationSessions.length, "Currently parked", "violet") +
      kpi("Live Session Payments", peso(liveTotal(d.reservationSessions, now)), "Updates in real time", "violet") +
      kpi("Occupied Reserved Slots", occupiedCount(d.reservationSessions, d), "Active reserved parking", "signal");
    $("sessions-count").textContent = d.reservationSessions.length + " active";
    var q = $("sessions-search").value;
    var rows = filterSessions(d.reservationSessions, q).map(function (x) {
      var dueMs = x.duration ? x.entry + x.duration * HOUR_MS : null;
      var due =
        dueMs === null
          ? '<span class="mono muted">Open Time</span>'
          : '<span class="mono ' +
            (now >= dueMs ? "text-red bold" : "") +
            '">' +
            dueTimeLabel(dueMs) +
            (now >= dueMs ? " · OVERDUE" : "") +
            "</span>";
      return (
        "<tr>" +
        td(x.id, "mono") +
        td(esc(x.plate), "mono bold") +
        td(x.vehicle, "muted") +
        td(x.slot, "mono") +
        td(clock(x.entry), "mono muted") +
        td(due) +
        td(durationLabel(x.entry, now), "mono") +
        td(peso(computeFee(x.vehicle, x.entry, now)), "mono text-right bold") +
        td('<button class="btn-sm" data-action="checkout" data-id="' + x.id + '">Check-out</button>', "text-right") +
        "</tr>"
      );
    });
    $("sessions-table").innerHTML = UI.table(
      ["Ticket", "Plate", "Vehicle", "Slot", "Entry", "Due / Exit Time", "Duration", { label: "Running Fee", className: "text-right" }, { label: "Action", className: "text-right" }],
      rows,
      q.trim() ? 'No results for "' + q.trim() + '"' : "No active reservation sessions.",
      "plain",
    );
  }

  function renderWalkIns(d) {
    var now = Date.now();
    $("walkins-kpis").innerHTML =
      kpi("Active Walk-ins", d.walkIns.length, "Current facility", "violet") +
      kpi("Live Running Payments", peso(liveTotal(d.walkIns, now)), "Updates in real time", "violet") +
      kpi("Occupied Walk-in Slots", occupiedCount(d.walkIns, d), "Currently occupied", "signal");
    var q = $("walkins-search").value;
    var rows = filterSessions(d.walkIns, q).map(function (x) {
      return (
        "<tr>" +
        td(x.id, "mono") +
        td(esc(x.plate), "mono bold") +
        td(esc(x.driver)) +
        td(x.vehicle, "muted") +
        td(x.slot, "mono") +
        td(clock(x.entry), "mono muted") +
        td(durationLabel(x.entry, now), "mono") +
        td(peso(computeFee(x.vehicle, x.entry, now)), "mono text-right bold text-green") +
        td('<button class="btn-sm" data-action="checkout" data-id="' + x.id + '">Check-out</button>', "text-right") +
        "</tr>"
      );
    });
    $("walkins-table").innerHTML = UI.table(
      ["Ticket", "Plate", "Name", "Vehicle", "Slot", "Entry", "Active Session", { label: "Real-time Payment", className: "text-right" }, { label: "Action", className: "text-right" }],
      rows,
      q.trim() ? 'No results for "' + q.trim() + '"' : "No active walk-in customers.",
      "plain",
    );
  }

  /* ---------- Reservations ---------- */
  function renderReservations(d) {
    $("reservations-count").textContent = d.reservations.length + " reserved";
    var rows = d.reservations.map(function (r) {
      var startMs = reservationStartMs(r);
      var endMs = startMs + r.hours * HOUR_MS;
      var now = Date.now();
      var past = startMs < now;
      var expired = endMs <= now;
      return (
        '<tr class="' +
        (past ? "is-dim" : "") +
        '">' +
        td(r.id, "mono") +
        td(esc(r.plate), "mono bold") +
        td(r.vehicle, "muted") +
        td(esc(r.driver)) +
        td(r.slot, "mono") +
        td(fmtISODate(r.date), "mono") +
        td(fmtHHMM(r.time), "mono") +
        td(dueTimeLabel(endMs), "mono " + (expired ? "text-red bold" : "")) +
        td(r.hours + "h", "mono") +
        td(peso(reservationFee(r)), "mono text-right bold text-green") +
        td(
          '<div class="cell-actions">' +
            (past ? '<span class="mono text-red" style="font-size:10px;text-transform:uppercase">' + (expired ? "Time Expired" : "Late Arrival") + "</span>" : "") +
            '<button class="btn-sm green" data-action="approve" data-id="' +
            r.id +
            '">Approve</button><button class="btn-sm red" data-action="cancel-res" data-id="' +
            r.id +
            '">Cancel</button></div>',
        ) +
        "</tr>"
      );
    });
    $("reservations-table").innerHTML = UI.table(
      ["Reservation ID", "Plate", "Vehicle", "Driver", "Slot", "Date", "Arrival Time", "Exit Time", "Duration", { label: "Total Paid", className: "text-right" }, { label: "Action", className: "text-right" }],
      rows,
      "No reservations for this facility.",
      "plain",
    );
  }

  /* ---------- History ---------- */
  function renderHistory(d) {
    var total = d.history.reduce(function (sum, h) {
      return sum + (h.amount || 0);
    }, 0);
    $("history-kpis").innerHTML =
      kpi("Completed Sessions", d.history.length, "Parking history", "violet") +
      kpi("Total Payments", peso(total), "Recorded revenue", "violet") +
      kpi(
        "Paid Transactions",
        d.history.filter(function (h) {
          return h.paid;
        }).length,
        "Successfully paid",
        "available",
      );
    $("history-table").innerHTML = UI.table(
      ["Ticket", "Plate", "Slot", "Duration", "Payment", { label: "Amount", className: "text-right" }],
      d.history.map(function (h) {
        return (
          "<tr>" +
          td(h.id, "mono") +
          td(esc(h.plate), "mono bold") +
          td(h.slot, "mono") +
          td(h.exit ? durationLabel(h.entry, h.exit) : "—", "mono muted") +
          td('<span class="mono ' + (h.paid ? "text-green" : "text-red") + '" style="font-size:11px;text-transform:uppercase">' + (h.paid ? "Paid" : "Unpaid") + "</span>") +
          td(peso(h.amount || 0), "mono text-right bold") +
          "</tr>"
        );
      }),
      "No transactions for this facility.",
      "plain",
    );
  }

  /* ---------- Arrival alerts (driver arriving within 30 seconds) ---------- */
  function checkArrivals() {
    var now = Date.now();
    var incoming = scope().reservations.filter(function (r) {
      var secs = (reservationStartMs(r) - now) / 1000;
      return secs <= 30 && secs > 0 && !ui.firedAlerts[r.id];
    });
    incoming.forEach(function (r) {
      ui.firedAlerts[r.id] = true;
      ui.alerts.push(r.id);
    });
    if (incoming.length) renderAlerts();
  }

  function renderAlerts() {
    var s = Store.get();
    ui.alerts = ui.alerts.filter(function (id) {
      return s.reservations.some(function (r) {
        return r.id === id;
      });
    });
    $("alert-stack").innerHTML = ui.alerts
      .map(function (id) {
        var r = s.reservations.find(function (x) {
          return x.id === id;
        });
        return (
          '<div class="alert-card"><div class="alert-card-head"><span>⚑ Driver Arriving — 30 seconds</span><button data-action="dismiss-alert" data-id="' +
          r.id +
          '">✕</button></div><div class="info-grid">' +
          UI.infoCell("Reservation", r.id, { mono: true }) +
          UI.infoCell("Slot", r.slot, { mono: true, accent: true }) +
          UI.infoCell("Driver", r.driver) +
          UI.infoCell("Plate", r.plate, { mono: true }) +
          UI.infoCell("Vehicle", r.vehicle) +
          UI.infoCell("Entry Time", fmtHHMM(r.time), { mono: true }) +
          '</div><div class="alert-card-actions"><button class="approve" data-action="approve-alert" data-id="' +
          r.id +
          '">✓ Approve Arrival</button><button class="dismiss" data-action="dismiss-alert" data-id="' +
          r.id +
          '">Dismiss</button></div></div>'
        );
      })
      .join("");
  }

  /* ---------- render ---------- */
  var RENDERERS = {
    facility: renderFacility,
    map: renderMap,
    sessions: renderSessions,
    walkins: renderWalkIns,
    reservations: renderReservations,
    history: renderHistory,
  };

  function render() {
    var d = scope();
    UI.setNavBadge("badge-sessions", d.reservationSessions.length ? String(d.reservationSessions.length) : "");
    UI.setNavBadge("badge-walkins", d.walkIns.length ? String(d.walkIns.length) : "");
    UI.setNavBadge("badge-reservations", d.reservations.length ? String(d.reservations.length) : "");
    RENDERERS[ui.view](d);
    renderAlerts();
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");
    var id = el.getAttribute("data-id");

    switch (action) {
      case "select-facility":
        ui.facilityId = el.getAttribute("data-facility");
        ui.zone = "ALL";
        ui.selectedSlotId = null;
        ui.manualSlotId = null;
        break;
      case "vehicle":
        ui.vehicle = el.getAttribute("data-vehicle");
        break;
      case "clear-manual":
        ui.manualSlotId = null;
        break;
      case "dismiss-ticket":
        ui.ticket = null;
        break;
      case "zone":
        ui.zone = el.getAttribute("data-zone");
        break;
      case "select-slot":
        var slotId = el.getAttribute("data-slot");
        ui.selectedSlotId = ui.selectedSlotId === slotId ? null : slotId;
        ui.extending = false;
        ui.extendHours = 1;
        break;
      case "close-detail":
        ui.selectedSlotId = null;
        break;
      case "assign":
        var slot = Store.findSlot(ui.selectedSlotId);
        if (slot.vehicleType) ui.vehicle = slot.vehicleType;
        ui.manualSlotId = slot.id;
        ui.selectedSlotId = null;
        ui.view = "facility";
        Shell.show("facility");
        render();
        setTimeout(function () {
          $("entry-card").scrollIntoView({ behavior: "smooth", block: "start" });
          $("entry-plate").focus();
        }, 50);
        return;
      case "report-damage":
        Store.addDamageReport(ui.selectedSlotId, user.displayName);
        ui.selectedSlotId = null;
        break;
      case "checkout":
        ui.selectedSlotId = null;
        Store.recordExit(id);
        return; // store change triggers render
      case "approve":
      case "approve-alert":
        ui.selectedSlotId = null;
        ui.alerts = ui.alerts.filter(function (a) {
          return a !== id;
        });
        Store.approveReservation(id);
        return;
      case "cancel-res":
        ui.selectedSlotId = null;
        Store.cancelReservation(id);
        return;
      case "extend-toggle":
        ui.extending = !ui.extending;
        ui.extendHours = 1;
        break;
      case "extend-hours":
        ui.extendHours = +el.getAttribute("data-hours");
        break;
      case "extend-confirm":
        var hours = ui.extendHours;
        ui.extending = false;
        ui.extendHours = 1;
        Store.extendReservation(id, hours);
        return;
      case "dismiss-alert":
        ui.alerts = ui.alerts.filter(function (a) {
          return a !== id;
        });
        break;
      default:
        return;
    }
    render();
  });

  $("entry-plate").addEventListener("input", function () {
    syncEntryButton();
  });

  $("entry-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var d = scope();
    var slot = assignableSlot(d);
    var plate = $("entry-plate").value;
    if (!plate.trim() || !slot) return;
    ui.manualSlotId = null;
    Store.recordEntry({ plate: plate, driver: $("entry-driver").value, vehicle: ui.vehicle, slotId: slot.id }).then(function (session) {
      if (!session) return;
      ui.ticket = session;
      render();
    });
    $("entry-plate").value = "";
    $("entry-driver").value = "";
    render();
  });

  ["sessions-search", "walkins-search"].forEach(function (inputId) {
    var input = $(inputId);
    var clear = document.querySelector('[data-clear="' + inputId + '"]');
    input.addEventListener("input", function () {
      clear.hidden = !input.value;
      render();
    });
    clear.addEventListener("click", function () {
      input.value = "";
      clear.hidden = true;
      render();
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && ui.selectedSlotId) {
      ui.selectedSlotId = null;
      render();
    }
  });

  Store.subscribe(render);
  render();

  // Live fees / durations refresh every second.
  setInterval(function () {
    if (ui.view === "sessions" || ui.view === "walkins" || (ui.view === "map" && ui.selectedSlotId)) render();
  }, 1000);

  checkArrivals();
  setInterval(checkArrivals, 5000);
});
