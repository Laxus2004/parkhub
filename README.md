ParkHub — HTML / CSS / JavaScript version
Plain HTML, CSS and vanilla JavaScript version of the Community-Based Parking Facility Management System. There is no build step or framework; serve it through XAMPP at http://localhost/parkhub/ so the PHP backend is available.

Pages
File Who
index.html Sign in + driver registration
superadmin.html Super Admin (admin)
staff.html Staff (staff1, staff2)
driver.html Driver (vintoy or new accounts)
All demo passwords are 12345. After you sign in, you are sent to the page for your role. Each dashboard page redirects to index.html when nobody is signed in.

Files
css/styles.css All styling (fonts, design tokens, layout, components)
fonts/ Archivo, Inter, JetBrains Mono (.woff2) — bundled, no internet needed
images/ Facility photos
js/data.js Seed data (facilities, slots, accounts) + format helpers
js/store.js App state + every business action (login, entry, exit,
reservations, approvals, damage reports, notifications …)
js/ui.js Shared HTML helpers (KPI tiles, slot tiles, tables) and the
sidebar/header shell
js/auth.js Sign in / register logic
js/superadmin.js Super Admin dashboard
js/staff.js Staff dashboard
js/driver.js Driver portal
Works offline
Fonts and photos are stored in this folder, so the system runs with no internet connection. Only the driver's Get Directions button needs internet (it opens Google Maps).

Data storage (PHP + MySQL backend)
All data lives in the MySQL database parkhub_db and is reached through the PHP files in api/. Run the app from XAMPP at http://localhost/parkhub/ (not by opening the HTML file), with Apache and MySQL started.

File Purpose
api/config.php Database connection settings (XAMPP default: root, no password)
api/helpers.php Shared helpers and the state builder
api/state.php GET the full app state for the signed-in user
api/auth.php Sign in, register, sign out
api/staff.php Entry, exit, approve / cancel / extend reservations, damage
api/admin.php Resolve damage, out of service, reset demo data
api/driver.php Reserve, cancel, extend parking
api/account.php Profile and notifications
api/alerts.php Driver reminders, expiry warnings and automatic endings
js/store.js calls these files, keeps the latest state in memory, and refreshes it every 5 seconds so open pages stay in sync. While the driver portal is open, it also calls api/alerts.php every 30 seconds to process reminders and expirations.
