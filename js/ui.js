/* ==========================================================================
   ParkHub — Shared UI helpers used by every role page
   Each helper returns an HTML string that pages insert with innerHTML.
   ========================================================================== */

var UI = (function () {
  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var STATUS_LABEL = {
    available: "Available",
    occupied: "Occupied",
    reserved: "Reserved",
    out_of_service: "Out of Service",
  };

  var STATUS_BADGE = {
    available: "badge--green",
    occupied: "badge--red",
    reserved: "badge--amber",
    out_of_service: "badge--gray",
  };

  function dot(status) {
    return '<span class="dot dot--' + status + '"></span>';
  }

  function statusBadge(status) {
    return '<span class="badge ' + (STATUS_BADGE[status] || "badge--gray") + '">' + (STATUS_LABEL[status] || status) + "</span>";
  }

  function badge(text, tone) {
    return '<span class="badge badge--' + tone + '">' + esc(text) + "</span>";
  }

  /**
   * Gradient KPI tile.
   * opts: { label, value, sub, gradient: 'emerald'|'blue'|'amber'|'violet'|'red'|'teal', size: 'lg'|'stat' }
   */
  function kpi(opts) {
    var cls = "kpi g-" + (opts.gradient || "blue") + (opts.size ? " kpi--" + opts.size : "");
    if (opts.size === "stat") {
      return (
        '<div class="' + cls + '"><div class="kpi-value">' + esc(opts.value) + '</div><div class="kpi-sub">' + esc(opts.label) + "</div></div>"
      );
    }
    return (
      '<div class="' +
      cls +
      '"><div class="kpi-label">' +
      esc(opts.label) +
      '</div><div class="kpi-value">' +
      esc(opts.value) +
      "</div>" +
      (opts.sub ? '<div class="kpi-sub">' + esc(opts.sub) + "</div>" : "") +
      "</div>"
    );
  }

  /** Super-admin palette: picks a gradient from the label length (matches the React version). */
  function paletteFor(label) {
    var list = ["emerald", "blue", "amber", "violet", "red", "teal"];
    return list[label.length % list.length];
  }

  /**
   * One slot tile for the slot maps.
   * mode: 'view' (read-only div), 'staff' (selectable button), 'driver' (pick available only)
   */
  function slotCell(slot, opts) {
    opts = opts || {};
    var mode = opts.mode || "view";
    var classes = ["slot", "slot--" + slot.status];
    if (slot.isPwd) classes.push("is-pwd");
    if (opts.fromReservation) classes.push("from-reservation");
    if (opts.selected) classes.push("is-selected");
    var available = slot.status === "available";
    if (mode === "driver" && !available) classes.push("is-locked");

    var sub;
    if (mode === "driver") {
      sub = available ? "open" : slot.status === "out_of_service" ? "OOS" : slot.status === "reserved" ? "RSVD" : "—";
    } else {
      sub = slot.status === "out_of_service" ? "OOS" : slot.plate || (slot.status === "reserved" ? "RSVD" : "—");
    }

    var vType = slot.vehicleType
      ? '<span class="vbadge vbadge--' + slot.vehicleType.charAt(0) + '" title="' + slot.vehicleType + ' only">' + slot.vehicleType.charAt(0) + "</span>"
      : "";
    var pwdDot = slot.isPwd ? '<span class="dot dot--pwd" title="PWD slot"></span>' : "";

    var inner =
      '<div class="slot-row"><span class="slot-id">' +
      slot.id +
      '</span><span class="slot-icons">' +
      vType +
      pwdDot +
      dot(slot.status) +
      "</span></div>" +
      '<div class="slot-row bottom"><span class="slot-sub">' +
      esc(sub) +
      "</span>" +
      (slot.isPwd ? '<span class="pwd-tag">PWD</span>' : "") +
      "</div>";

    var title = slot.id + " — " + STATUS_LABEL[slot.status];

    if (mode === "view") {
      return '<div class="' + classes.join(" ") + '" title="' + title + '">' + inner + "</div>";
    }
    if (mode === "driver") {
      return (
        '<button type="button" class="' +
        classes.join(" ") +
        '" data-action="pick-slot" data-slot="' +
        slot.id +
        '" ' +
        (available ? 'title="Select slot ' + slot.id + '"' : 'disabled title="' + title + '"') +
        ">" +
        inner +
        (available ? '<span class="slot-select-hint"><span>Select</span></span>' : "") +
        "</button>"
      );
    }
    return (
      '<button type="button" class="' + classes.join(" ") + '" data-action="select-slot" data-slot="' + slot.id + '" title="' + title + '">' + inner + "</button>"
    );
  }

  function legend(showVehicleTypes, extraClass) {
    var html = '<div class="legend ' + (extraClass || "") + '">';
    ["available", "occupied", "reserved", "out_of_service"].forEach(function (s) {
      html += '<span class="legend-item">' + dot(s) + STATUS_LABEL[s] + "</span>";
    });
    html += '<span class="legend-item"><span class="dot dot--pwd"></span>PWD Slot</span>';
    if (showVehicleTypes) {
      html += '<span class="legend-item"><span class="vbadge vbadge--A">A</span>Automobile Only</span>';
      html += '<span class="legend-item"><span class="vbadge vbadge--M">M</span>Motorcycle Only</span>';
    }
    return html + "</div>";
  }

  /** Builds a <table>. rows = array of HTML strings for <tr>. */
  function table(columns, rows, emptyMessage, tableClass) {
    var head = columns
      .map(function (c) {
        var label = typeof c === "string" ? c : c.label;
        var cls = typeof c === "string" ? "" : c.className || "";
        return '<th class="' + cls + '">' + esc(label) + "</th>";
      })
      .join("");
    var body = rows.length
      ? rows.join("")
      : '<tr><td class="empty" colspan="' + columns.length + '">' + esc(emptyMessage) + "</td></tr>";
    return (
      '<div class="table-wrap"><table class="data ' +
      (tableClass || "") +
      '"><thead><tr>' +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div>"
    );
  }

  function td(content, cls) {
    return '<td class="' + (cls || "") + '">' + content + "</td>";
  }

  function infoCell(label, value, opts) {
    opts = opts || {};
    return (
      '<div class="info-cell ' +
      (opts.lg ? "lg" : "") +
      '"><span class="label">' +
      esc(label) +
      '</span><div class="info-value ' +
      (opts.mono ? "mono " : "") +
      (opts.accent ? "accent" : "") +
      '">' +
      esc(value) +
      "</div></div>"
    );
  }

  function facilityTabs(selectedId) {
    return FACILITIES.map(function (f) {
      return (
        '<button type="button" class="facility-tab ' +
        (f.id === selectedId ? "is-active" : "") +
        '" data-action="select-facility" data-facility="' +
        f.id +
        '"><div class="facility-tab-name">' +
        esc(f.name) +
        '</div><div class="facility-tab-meta">' +
        f.zones.length +
        " zones · " +
        f.total +
        " slots</div></button>"
      );
    }).join("");
  }

  function zoneChips(zones, active) {
    return ["ALL"]
      .concat(zones)
      .map(function (z) {
        return (
          '<button type="button" class="chip ' +
          (z === active ? "is-active" : "") +
          '" data-action="zone" data-zone="' +
          z +
          '">' +
          (z === "ALL" ? "All" : "Zone " + z) +
          "</button>"
        );
      })
      .join("");
  }

  /** Deterministic placeholder QR grid built from the reference string. */
  function qr(ref, amount) {
    var cells = "";
    for (var i = 0; i < 121; i++) {
      var code = ref.charCodeAt(i % ref.length) + amount + i;
      cells += code % 3 !== 0 ? '<i class="on"></i>' : "<i></i>";
    }
    return '<div class="qr">' + cells + "</div>";
  }

  function setNavBadge(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if (value) {
      el.textContent = value;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  return {
    esc: esc,
    dot: dot,
    statusBadge: statusBadge,
    badge: badge,
    kpi: kpi,
    paletteFor: paletteFor,
    slotCell: slotCell,
    legend: legend,
    table: table,
    td: td,
    infoCell: infoCell,
    facilityTabs: facilityTabs,
    zoneChips: zoneChips,
    qr: qr,
    setNavBadge: setNavBadge,
    STATUS_LABEL: STATUS_LABEL,
  };
})();

/* ==========================================================================
   Shell — sidebar, header, auth guard and navigation for dashboard pages
   ========================================================================== */

var Shell = (function () {
  var ROLE_PAGES = { superadmin: "superadmin.html", staff: "staff.html", driver: "driver.html" };

  /** Redirects to the login page unless the signed-in user has the role. */
  function requireRole(role) {
    var user = Store.currentUser();
    if (!user) {
      window.location.replace("index.html");
      return null;
    }
    if (user.role !== role) {
      window.location.replace(ROLE_PAGES[user.role]);
      return null;
    }
    return user;
  }

  /**
   * Wires the common shell.
   * opts: { user, navOpen, onNavigate(viewId) }
   * Sidebar buttons use data-nav="viewId"; content sections use data-view="viewId".
   */
  function init(opts) {
    var body = document.body;
    body.classList.toggle("nav-open", !!opts.navOpen);
    refreshUser(opts.user);

    var toggle = document.getElementById("menu-toggle");
    toggle.addEventListener("click", function () {
      var open = body.classList.toggle("nav-open");
      toggle.setAttribute("aria-label", open ? "Hide navigation" : "Show navigation");
      toggle.title = open ? "Hide navigation" : "Show navigation";
    });

    document.querySelectorAll("[data-logout]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        body.classList.remove("nav-open");
        Store.logout().then(function () {
          window.location.href = "index.html";
        });
      });
    });

    document.querySelectorAll("[data-nav]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        show(btn.getAttribute("data-nav"));
        if (opts.onNavigate) opts.onNavigate(btn.getAttribute("data-nav"));
      });
    });
  }

  function refreshUser(user) {
    var nameEl = document.getElementById("user-name");
    var avatarEl = document.getElementById("user-avatar");
    if (nameEl) nameEl.textContent = user.displayName;
    if (avatarEl && !avatarEl.querySelector("img")) avatarEl.textContent = user.displayName.charAt(0).toUpperCase();
  }

  /** Shows one content view and highlights its sidebar button. */
  function show(viewId) {
    document.querySelectorAll("[data-view]").forEach(function (section) {
      section.hidden = section.getAttribute("data-view") !== viewId;
    });
    document.querySelectorAll("[data-nav]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-nav") === viewId);
    });
    var ws = document.querySelector(".workspace");
    if (ws) ws.scrollTop = 0;
  }

  return { requireRole: requireRole, init: init, show: show, refreshUser: refreshUser, ROLE_PAGES: ROLE_PAGES };
})();
