# VistaraX — Visitor Management System

A standalone, self-hosted visitor management & reception dashboard, built in
the **Premium Glass Command Center** style: a dark, glass-surfaced UI with
blue/violet accents, photo-first visitor records, live activity, and
role-based access for Admins and Entry Boys.

This is a complete full-stack project you own and run yourself — no
third-party visitor-management SaaS, no external database service required.

---

## 1. What's inside

```
vistarax/
├── backend/     Node.js + Express API, SQLite database, JWT auth, Socket.IO
└── frontend/    React + Vite + Tailwind CSS dashboard (Premium Glass Command Center UI)
```

**Backend stack:** Express, better-sqlite3 (file-based DB, no server to install),
JWT + bcrypt authentication, helmet, express-rate-limit, express-validator,
multer (photo uploads), Socket.IO (real-time notifications), pdfkit + xlsx
(exports).

**Frontend stack:** React 18, Vite, Tailwind CSS, React Router, Recharts
(charts), Leaflet + OpenStreetMap (location pin, no API key needed),
Socket.IO client, Lucide icons.

---

## 2. Features

- **Visitors:** serial no. (auto-generated `VST-YYYY-000001`), name, contact
  number, WhatsApp number (optional), companions, whom-to-visit, purpose,
  check-in/out timestamps, photo (camera capture or upload), GPS location +
  address (map pin), visit date & day, remarks.
- **Search & filter:** by name, contact, WhatsApp, serial no., host, purpose,
  address, status, and date range.
- **Delete:** single-record delete, and an admin-only "Delete All" that
  requires typing `DELETE` to confirm.
- **Edit** any visitor record; **View** opens a full profile with a
  full-screen photo viewer.
- **Export:** CSV, Excel (.xlsx), and PDF (photos included in the PDF
  register).
- **Print:** a dedicated printable visitor register with photos.
- **Roles:** Admin (full access) and Entry Boy (front-desk operations only —
  no user management, no settings, no delete-all). Enforced on the **server**,
  not just hidden in the UI.
- **Dashboard:** KPI cards, 7-day visitor activity chart, purpose breakdown,
  recent entries.
- **Currently Inside:** live view of visitors on premises with a running
  duration and a warning past 2 hours.
- **Real-time notifications:** Socket.IO pushes check-in / check-out toasts
  to every connected staff member instantly; a notification feed keeps
  history.
- **Settings:** company name/logo/address, photo-required / location-required
  toggles, accent color.
- **Security:** bcrypt-hashed passwords, JWT sessions, login rate limiting +
  account lockout after repeated failures, helmet security headers, strict
  input validation, parameterized SQL (no injection surface), audit log of
  every create/update/delete/export/login action, file-type & size validated
  uploads.

---

## 3. Prerequisites

- Node.js **18+** and npm
- That's it — the database is a local SQLite file, there is no separate
  database server to install.

---

## 4. Setup

### Backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and set at minimum:

- `JWT_SECRET` — a long random string (32+ characters). **Never use the
  example value in production.** Generate one with:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` — the admin account
  created automatically the first time the server starts (only if no users
  exist yet). **Log in and change this password immediately.**
- `CORS_ORIGIN` — the URL the frontend will be served from (default
  `http://localhost:5173`).

Install and run:

```bash
npm install
npm run dev      # starts on http://localhost:5000 (auto-reload via nodemon)
# or: npm start  # plain node, for production
```

On first run you'll see:
`[VistaraX] Seeded default admin user "admin". Please log in and change the password immediately.`

### Frontend

```bash
cd frontend
cp .env.example .env
```

Set `VITE_API_URL` in `.env` if your backend isn't on `http://localhost:5000`.

```bash
npm install
npm run dev       # starts on http://localhost:5173
```

Open `http://localhost:5173`, sign in with the admin credentials from your
backend `.env`, and change the password from **Settings → Change Password**
right away.

### Production build

```bash
cd frontend
npm run build      # outputs static files to frontend/dist
```

Serve `frontend/dist` with any static file host (nginx, Caddy, etc.) and run
the backend behind a process manager (pm2, systemd) with `npm start`. Put
both behind HTTPS in production — set `CORS_ORIGIN` to your real frontend
domain and update `VITE_API_URL` to your real backend domain.

---

## 5. Default login

| Field    | Value (from `.env.example`) |
|----------|------------------------------|
| Username | `admin`                      |
| Password | `ChangeMe@123`                |

**Change this password on first login.** The account is only auto-created
when the `users` table is empty, so changing `.env` after the first run has
no effect — manage users from the **Users** page instead.

---

## 6. Roles

- **Admin** — everything: visitor CRUD, delete-all, exports, reports, user
  management, settings.
- **Entry Boy** — day-to-day reception work: add/view/edit visitors, check
  visitors out, search. No access to Users, Settings, Reports, or Delete All
  (both hidden in the UI and rejected by the API if attempted directly).

Add more Entry Boy or Admin accounts from **Users** (admin only).

---

## 7. Data & backups

Everything lives in `backend/data/vistarax.db` (SQLite) and
`backend/uploads/visitors/` (photos). To back up, copy both. To reset,
stop the server and delete `backend/data/vistarax.db*` — it will be
recreated with a fresh default admin on next start.

---

## 8. Security notes

- Change `JWT_SECRET` and the default admin password before any real use.
- Run behind HTTPS in production — set `CORS_ORIGIN` accordingly.
- The login endpoint is rate-limited (8 attempts / 15 min per IP) and
  accounts lock for 15 minutes after 5 failed password attempts.
- Every meaningful action (login, visitor CRUD, exports, user management) is
  written to `audit_logs` for accountability.
- Role checks happen in Express middleware (`requireRole`) on every
  protected route — the frontend hiding a button is a convenience, not the
  actual security boundary.

---

## 9. Extending it

The codebase is deliberately small and readable so you can extend it:

- Swap SQLite for PostgreSQL by replacing `backend/src/db.js` — every route
  only calls the exported `db` object's prepared-statement style methods.
- Add QR visitor badges, duplicate-visitor detection, or a mobile kiosk mode
  as new routes/pages following the existing patterns.
- The Socket.IO layer (`backend/src/socket.js`) already broadcasts
  `visitor:checkin` / `visitor:checkout` / `visitor:deleted` — subscribe to
  more events there for SMS/email alerts, etc.

---

Built as a standalone system — **VistaraX**: *Every Visitor. Every Entry.
Fully Connected.*
