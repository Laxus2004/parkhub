/* ==========================================================================
   ParkHub — Super Admin dashboard (superadmin.html)
   ========================================================================== */

Store.ready(function () {
  var user = Shell.requireRole("superadmin");
  if (!user) return;

  var esc = UI.esc;
  var td = UI.td;
  var view = "overview";
  var facilityId = FACILITIES[0].id;
  var zone = "ALL";
  var search = "";
  var historyFilter = "all";

  Shell.init({
    user: user,
    navOpen: false,
    onNavigate: function (next) {
      view = next;
      render();
    },
  });

  /* ---------- derived data ---------- */
  function scope() {
    var s = Store.get();
    var slotFacility = {};
    s.slots.forEach(function (slot) {
      slotFacility[slot.id] = slot.facilityId;
    });
    var inFacility = function (slotId) {
      return slotFacility[slotId] === facilityId;
    };
    var slots = s.slots.filter(function (x) {
      return x.facilityId === facilityId;
    });
    var sessions = s.sessions.filter(function (x) {
      return inFacility(x.slot);
    });
    var count = function (status) {
      return slots.filter(function (x) {
        return x.status === status;
      }).length;
    };
    return {
      all: s,
      slotFacility: slotFacility,
      facility: getFacility(facilityId),
      slots: slots,
      sessions: sessions,
      walkIns: sessions.filter(function (x) {
        return !x.reservationId;
      }),
      reservationSessions: sessions.filter(function (x) {
        return !!x.reservationId;
      }),
      reservations: s.reservations.filter(function (x) {
        return inFacility(x.slot);
      }),
      history: s.history.filter(function (x) {
        return inFacility(x.slot);
      }),
      occupied: count("occupied"),
      reserved: count("reserved"),
      available: count("available"),
      oos: count("out_of_service"),
    };
  }

  function historyFee(h) {
    return h.amount || (h.duration ? RATES[h.vehicle] * h.duration : 0);
  }

  function kpis(list) {
    return list
      .map(function (k) {
        return UI.kpi({ label: k[0], value: k[1], gradient: UI.paletteFor(k[0]) });
      })
      .join("");
  }

  function set(id, html) {
    document.getElementById(id).innerHTML = html;
  }

  function text(id, value) {
    document.getElementById(id).textContent = value;
  }

  /* ---------- views ---------- */
  function renderOverview(d) {
    var revenue = d.history.reduce(function (sum, h) {
      return sum + historyFee(h);
    }, 0);
    var pct = d.slots.length ? Math.round(((d.occupied + d.reserved) / d.slots.length) * 100) : 0;
    text("overview-sub", "Welcome back, " + user.displayName + " — " + d.facility.name);
    set(
      "overview-kpis",
      kpis([
        ["Total Slots", d.slots.length],
        ["Occupied", d.occupied],
        ["Reserved", d.reserved],
        ["Available", d.available],
        ["Occupancy Rate", pct + "%"],
        ["Reservation Sessions", d.reservationSessions.length],
        ["Active Walk-ins", d.walkIns.length],
        ["Pending Reservations", d.reservations.length],
        ["Total Revenue", peso(revenue)],
      ]),
    );
  }

  function renderSlots(d) {
    var shown = zone === "ALL" ? d.slots : d.slots.filter(function (x) {
      return x.zone === zone;
    });
    text("slots-title", d.facility.name + " — Slot Map");
    text(
      "slots-summary",
      d.slots.length +
        " total · " +
        d.available +
        " available · " +
        d.occupied +
        " occupied · " +
        d.reserved +
        " reserved" +
        (d.oos ? " · " + d.oos + " OOS" : ""),
    );
    set("slots-zones", UI.zoneChips(d.facility.zones, zone));
    set(
      "slots-grid",
      shown
        .map(function (slot) {
          return UI.slotCell(slot, { mode: "view" });
        })
        .join(""),
    );
    set("slots-legend", UI.legend(true));
    text("slots-count", shown.length);
    set(
      "slots-table",
      UI.table(
        ["Slot ID", "Zone", "Facility", "Status", "Plate", "Current Session", "Driver"],
        shown.map(function (slot) {
          var sess = d.all.sessions.find(function (x) {
            return x.slot === slot.id;
          });
          return (
            "<tr>" +
            td(slot.id, "bold") +
            td(slot.zone) +
            td(esc(d.facility.name), "muted") +
            td(UI.statusBadge(slot.status)) +
            td(esc(slot.plate || "—")) +
            td(sess ? sess.id : "—") +
            td(sess ? esc(sess.driver) : "—") +
            "</tr>"
          );
        }),
        "No slots",
        "compact",
      ),
    );
  }

  function renderUsers(d) {
    var staff = d.all.accounts.filter(function (a) {
      return a.role === "staff";
    });
    var q = search.trim().toLowerCase();
    var drivers = d.all.accounts.filter(function (a) {
      return a.role === "driver" && (!q || a.displayName.toLowerCase().indexOf(q) !== -1 || a.username.indexOf(q) !== -1);
    });
    text("staff-count", staff.length);
    set(
      "staff-table",
      UI.table(
        ["Username", "Display Name", "Assigned Facility", "Role"],
        staff.map(function (a) {
          var fac = getFacility(a.facilityId);
          return (
            "<tr>" +
            td(esc(a.username), "bold") +
            td(esc(a.displayName)) +
            td(esc(fac ? fac.name : "—"), "muted") +
            td(UI.badge("Staff", "dark")) +
            "</tr>"
          );
        }),
        "No staff accounts",
        "compact",
      ),
    );
    text("drivers-count", drivers.length);
    set(
      "drivers-table",
      UI.table(
        ["Username", "Name", "Email", "Contact", "Active Sessions", "Completed"],
        drivers.map(function (a) {
          var active = d.all.sessions.filter(function (x) {
            return x.accountUsername === a.username;
          }).length;
          var done = d.all.history.filter(function (x) {
            return x.accountUsername === a.username;
          }).length;
          return (
            "<tr>" +
            td(esc(a.username), "bold") +
            td(esc(a.displayName)) +
            td(esc(a.email || "—"), "muted") +
            td(esc(a.contact || "—"), "muted") +
            td(active) +
            td(done) +
            "</tr>"
          );
        }),
        q ? 'No drivers match "' + search.trim() + '"' : "No driver accounts",
        "compact",
      ),
    );
  }

  function renderWalkIns(d) {
    var now = Date.now();
    var live = d.walkIns.reduce(function (sum, x) {
      return sum + computeFee(x.vehicle, x.entry, now);
    }, 0);
    var occupied = d.walkIns.filter(function (x) {
      var slot = Store.findSlot(x.slot);
      return slot && slot.status === "occupied";
    }).length;
    set(
      "walkins-kpis",
      kpis([
        ["Active Walk-ins", d.walkIns.length],
        ["Live Running Payments", peso(live)],
        ["Occupied Walk-in Slots", occupied],
      ]),
    );
    text("walkins-count", d.walkIns.length);
    set(
      "walkins-table",
      UI.table(
        ["Ticket", "Plate Number", "Name", "Vehicle Type", "Slot", "Entry", "Active Session", "Real-time Payment", "Status"],
        d.walkIns.map(function (x) {
          return (
            "<tr>" +
            td(x.id, "bold") +
            td(esc(x.plate)) +
            td(esc(x.driver)) +
            td(x.vehicle) +
            td(x.slot) +
            td(clock(x.entry), "muted") +
            td(durationLabel(x.entry, now)) +
            td(peso(computeFee(x.vehicle, x.entry, now)), "bold") +
            td(UI.badge("Active", "green")) +
            "</tr>"
          );
        }),
        "No active walk-in customers",
        "compact",
      ),
    );
  }

  function renderReservations(d) {
    var expected = d.reservations.reduce(function (sum, r) {
      return sum + reservationFee(r);
    }, 0);
    set(
      "reservations-kpis",
      kpis([
        ["Pending Reservations", d.reservations.length],
        ["Reserved Slots", d.reserved],
        ["Expected Revenue", peso(expected)],
      ]),
    );
    text("reservations-count", d.reservations.length);
    set(
      "reservations-table",
      UI.table(
        ["Res. ID", "Driver", "Slot", "Facility", "Vehicle", "Plate", "Date", "Arrival", "Duration", "Fee", "Status"],
        d.reservations.map(function (r) {
          var past = reservationStartMs(r) < Date.now();
          return (
            '<tr class="' +
            (past ? "is-dim" : "") +
            '">' +
            td(r.id, "bold") +
            td(esc(r.driver)) +
            td(r.slot) +
            td(esc(d.facility.name), "muted") +
            td(r.vehicle) +
            td(esc(r.plate)) +
            td(r.date) +
            td(r.time) +
            td(r.hours + "h") +
            td(peso(reservationFee(r)), "bold") +
            td(past ? UI.badge("Overdue", "red") : UI.badge("Pending", "amber")) +
            "</tr>"
          );
        }),
        "No reservations",
        "compact",
      ),
    );
  }

  function renderHistory(d) {
    var history = d.history.filter(function (h) {
      if (historyFilter === "walk-in") return !h.reservationId;
      if (historyFilter === "reservation") return !!h.reservationId;
      return true;
    });
    document.querySelectorAll("[data-history-filter]").forEach(function (button) {
      var active = button.getAttribute("data-history-filter") === historyFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    text("history-count", history.length);
    set(
      "history-table",
      UI.table(
        ["Session ID", "Method", "Driver", "Slot", "Facility", "Vehicle", "Plate", "Entry", "Exit", "Duration", "Fee"],
        history.map(function (h) {
          var exitMs = h.exit || (h.duration ? h.entry + h.duration * HOUR_MS : null);
          var fee = historyFee(h);
          return (
            "<tr>" +
            td(h.id, "bold") +
            td(h.reservationId ? UI.badge("Reservation", "amber") : UI.badge("Walk-in", "green")) +
            td(esc(h.driver)) +
            td(h.slot) +
            td(esc(d.facility.name), "muted") +
            td(h.vehicle) +
            td(esc(h.plate)) +
            td(fmtDate(h.entry) + " " + clock(h.entry)) +
            td(exitMs ? clock(exitMs) : "—") +
            td(exitMs ? durationLabel(h.entry, exitMs) : "—") +
            td(fee ? peso(fee) : "—", "bold") +
            "</tr>"
          );
        }),
        historyFilter === "all" ? "No history yet" : "No completed " + historyFilter + " sessions",
        "compact",
      ),
    );
  }

  function renderReports(d) {
    var all = d.all;
    var busy = all.slots.filter(function (x) {
      return x.status === "occupied" || x.status === "reserved";
    }).length;
    var oos = all.slots.filter(function (x) {
      return x.status === "out_of_service";
    }).length;
    set(
      "reports-kpis",
      kpis([
        ["Current Occupancy", (all.slots.length ? Math.round((busy / all.slots.length) * 100) : 0) + "%"],
        ["Total Sessions (All Time)", all.history.length + all.sessions.length],
        ["Out of Service Slots", oos],
      ]),
    );

    var openReports = all.damageReports.filter(function (r) {
      return !r.resolved;
    });
    var open = openReports.length;
    var pill = document.getElementById("damage-count");
    pill.hidden = open === 0;
    pill.textContent = open;

    set(
      "damage-table",
      UI.table(
        ["Slot", "Facility", "Reported By", "Date & Time", "Status", "Actions"],
        openReports.map(function (r) {
          var slot = Store.findSlot(r.slotId);
          var isOOS = slot && slot.status === "out_of_service";
          var status = r.resolved ? UI.badge("Resolved", "green") : UI.badge(isOOS ? "Out of Service" : "Open", "red");
          var action = r.resolved
            ? ""
            : isOOS
              ? '<button class="btn-sm green" data-action="resolve" data-id="' + r.id + '">Mark Resolved</button>'
              : '<button class="btn-sm red" data-action="mark-oos" data-slot="' + r.slotId + '">Mark Out of Service</button>';
          return (
            '<tr class="' +
            (r.resolved ? "is-faded" : "") +
            '">' +
            td(r.slotId, "bold") +
            td(esc(r.facilityName), "muted") +
            td(esc(r.reportedBy)) +
            td(fmtDateTime(r.timestamp), "muted") +
            td(status) +
            td(action) +
            "</tr>"
          );
        }),
        "No active damage reports",
        "compact",
      ),
    );

    var rows = all.accounts
      .filter(function (a) {
        return a.role === "driver";
      })
      .map(function (a) {
        var done = all.history.filter(function (h) {
          return h.accountUsername === a.username;
        });
        return {
          name: a.displayName,
          completed: done.length,
          active: all.sessions.filter(function (x) {
            return x.accountUsername === a.username;
          }).length,
          revenue: done.reduce(function (sum, h) {
            return sum + historyFee(h);
          }, 0),
        };
      })
      .sort(function (a, b) {
        return b.completed + b.active - (a.completed + a.active);
      });
    set(
      "drivers-activity-table",
      UI.table(
        ["Driver", "Completed Sessions", "Active Sessions", "Total Revenue"],
        rows.map(function (r) {
          return "<tr>" + td(esc(r.name), "bold") + td(r.completed) + td(r.active) + td(peso(r.revenue), "bold") + "</tr>";
        }),
        "No driver data",
        "compact",
      ),
    );
  }

  var RENDERERS = {
    overview: renderOverview,
    slots: renderSlots,
    users: renderUsers,
    walkins: renderWalkIns,
    reservations: renderReservations,
    history: renderHistory,
    reports: renderReports,
  };

  function render() {
    var d = scope();
    var tabs = document.getElementById("facility-tabs");
    tabs.hidden = view === "users" || view === "reports";
    tabs.innerHTML = UI.facilityTabs(facilityId);

    var open = d.all.damageReports.filter(function (r) {
      return !r.resolved;
    }).length;
    UI.setNavBadge("badge-reports", open ? String(open) : "");

    RENDERERS[view](d);
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");
    if (action === "select-facility") {
      facilityId = el.getAttribute("data-facility");
      zone = "ALL";
      render();
    } else if (action === "zone") {
      zone = el.getAttribute("data-zone");
      render();
    } else if (action === "history-filter") {
      historyFilter = el.getAttribute("data-history-filter");
      render();
    } else if (action === "resolve") {
      Store.resolveDamageReport(el.getAttribute("data-id"));
    } else if (action === "mark-oos") {
      Store.markOutOfService(el.getAttribute("data-slot"));
    }
  });

  document.getElementById("users-search").addEventListener("input", function (e) {
    search = e.target.value;
    render();
  });

  document.getElementById("reset-data").addEventListener("click", function () {
    if (confirm("Reset all parking data to the original demo state? All parking activity will be cleared; accounts are kept.")) {
      Store.reset();
    }
  });

  Store.subscribe(render);
  render();

  // Live running fees on the Walk-ins page.
  setInterval(function () {
    if (view === "walkins") render();
  }, 1000);
});
