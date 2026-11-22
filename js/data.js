/* ==========================================================================
   ParkHub — Seed data and formatting helpers
   Context: University of the Visayas area, Cebu City. Currency: Philippine peso.
   When the backend is ready, this seed data should come from the database.
   ========================================================================== */

var RATES = { Automobile: 50, Motorcycle: 30 }
var VEHICLES = ["Automobile", "Motorcycle"]
var HOUR_MS = 3600000
var MIN_MS = 60000

var FACILITIES = [
  {
    id: "fac-sanciangko",
    name: "Sanciangko Parking Plaza",
    address: "Sanciangko St., Cebu City",
    distanceKm: 0.6,
    total: 40,
    ratePerHour: 50,
    motorcycleRate: 30,
    open: "24/7",
    photo: "images/sanciangko-parking-plaza.jpg",
    zones: ["A", "B", "C", "D"],
    automobileZones: ["A", "B"],
    zoneStarts: { D: 11 },
    pwd: ["A-10"],
    outOfService: ["B-03", "C-08"],
  },
  {
    id: "fac-plaza-independencia",
    name: "Plaza Independencia Parking",
    address: "Plaza Independencia, Cebu City",
    distanceKm: 1.1,
    total: 40,
    ratePerHour: 50,
    motorcycleRate: 30,
    open: "24/7",
    photo: "images/plaza-independencia-parking.jpg",
    zones: ["D", "E", "F", "G"],
    automobileZones: ["D", "E"],
    pwd: ["D-10", "E-10"],
    outOfService: ["F-07", "G-04"],
  },
]

var SEED_ACCOUNTS = [
  {
    username: "admin",
    password: "12345",
    role: "superadmin",
    displayName: "Super Admin",
  },
  {
    username: "staff1",
    password: "12345",
    role: "staff",
    displayName: "Staff 1",
    facilityId: "fac-sanciangko",
  },
  {
    username: "staff2",
    password: "12345",
    role: "staff",
    displayName: "Staff 2",
    facilityId: "fac-plaza-independencia",
  },
  {
    username: "vintoy",
    password: "12345",
    role: "driver",
    displayName: "Vintoy",
    firstName: "Vintoy",
    lastName: "",
    contact: "09919089508",
    email: "vintoy123@gmail.com",
  },
]

/**
 * Builds 10 slots per zone. Sanciangko Zone D starts at D-11 because
 * Plaza Independencia already owns the globally unique IDs D-01 … D-10.
 */
function buildSeedSlots() {
  var slots = []
  FACILITIES.forEach(function (facility) {
    facility.zones.forEach(function (zone) {
      var start = (facility.zoneStarts && facility.zoneStarts[zone]) || 1
      for (var i = start; i < start + 10; i++) {
        var id = zone + "-" + String(i).padStart(2, "0")
        slots.push({
          id: id,
          zone: zone,
          facilityId: facility.id,
          status:
            facility.outOfService.indexOf(id) !== -1
              ? "out_of_service"
              : "available",
          plate: null,
          isPwd: facility.pwd.indexOf(id) !== -1,
          vehicleType:
            facility.automobileZones.indexOf(zone) !== -1
              ? "Automobile"
              : "Motorcycle",
        })
      }
    })
  })
  return slots
}

function getFacility(id) {
  return FACILITIES.find(function (f) {
    return f.id === id
  })
}

/* ---------- Formatting helpers ---------- */

function peso(n) {
  return (
    "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })
  )
}

function durationLabel(fromMs, toMs) {
  var totalMin = Math.max(1, Math.round((toMs - fromMs) / MIN_MS))
  var h = Math.floor(totalMin / 60)
  var m = totalMin % 60
  if (h === 0) return m + "m"
  return h + "h " + String(m).padStart(2, "0") + "m"
}

function billedHours(fromMs, toMs) {
  return Math.max(1, Math.ceil((toMs - fromMs) / HOUR_MS))
}

function computeFee(vehicle, fromMs, toMs) {
  return billedHours(fromMs, toMs) * RATES[vehicle]
}

function clock(ms) {
  return new Date(ms).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function fmtDate(ms) {
  return new Date(ms).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function fmtDateShort(ms) {
  return new Date(ms).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  })
}

function fmtDateTime(ms) {
  return new Date(ms).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/** "14:30" → "2:30 PM" */
function fmtHHMM(hhmm) {
  if (!hhmm) return "—"
  var parts = hhmm.split(":")
  var d = new Date()
  d.setHours(+parts[0], +parts[1], 0, 0)
  return clock(d.getTime())
}

/** "2025-05-01" → "May 1, 2025" */
function fmtISODate(iso) {
  if (!iso) return "—"
  return fmtDate(new Date(iso + "T00:00").getTime())
}

function reservationStartMs(r) {
  return new Date(r.date + "T" + r.time).getTime()
}

function reservationFee(r) {
  return RATES[r.vehicle] * (r.hours || 2)
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function todayISO() {
  var d = new Date()
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  )
}
