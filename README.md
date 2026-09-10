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


## 6. Roles

- **Admin** — everything: visitor CRUD, delete-all, exports, reports, user
  management, settings.
- **Entry Boy** — day-to-day reception work: add/view/edit visitors, check
  visitors out, search. No access to Users, Settings, Reports, or Delete All
  (both hidden in the UI and rejected by the API if attempted directly).

Add more Entry Boy or Admin accounts from **Users** (admin only).


Built as a standalone system — **VistaraX**: *Every Visitor. Every Entry.
Fully Connected.*
