# Hostel Attendance Register

A self-contained web application for taking room-wise hostel attendance.
Everything the app needs — code **and** data — lives inside this one git
repository. There is no external database server to provision: the data
store is a single SQLite file at `database/hostel.db`, created and updated
by the app itself and versioned like any other file in the repo.

---

## 1. How the app is put together

```
hostel-attendance-app/
├── server/                  Express backend
│   ├── index.js             App entry point / route wiring
│   ├── db.js                SQLite schema + connection (node:sqlite, built into Node.js)
│   ├── middleware/auth.js   Session guard for protected API routes
│   ├── routes/
│   │   ├── auth.js          Signup / login / logout / session check
│   │   ├── students.js      CSV import, listing+sorting, present/absent toggle, OTP add-entry
│   │   └── report.js        Aggregated present/absent counts for the charts
│   └── utils/
│       ├── mailer.js        Nodemailer wrapper (sends OTP e-mails)
│       └── otp.js           OTP generation / hashing / expiry / verification
├── public/                  Static front-end (plain HTML/CSS/JS, no build step)
│   ├── index.html           Sign-in page (first screen)
│   ├── signup.html          "Create your login credential" page
│   ├── upload.html          CSV import page (forced step after signup)
│   ├── dashboard.html       The register: sortable table + sidebar add-entry
│   ├── report.html          Pie-chart attendance report
│   ├── css/style.css        Academic / ledger-style theme
│   └── js/                  Front-end logic for each page
├── sample-data/sample_students.csv   Reference sheet with the required columns
├── database/                 SQLite database file lives here (tracked in git)
└── .env.example               Copy to .env and fill in your SMTP + secret values
```

### Why `node:sqlite` instead of a driver package?
Node.js 22.5+ ships a built-in SQLite driver (`node:sqlite`). Using it means
`npm install` never needs to compile a native addon — clone the repo on any
machine with a modern Node version and it just works, which matters a lot
once the database itself is meant to travel inside the git repo.

---

## 2. User flow (exactly as specified)

1. **Create a login credential** — `signup.html` creates a username/password
   account (password stored as a bcrypt hash, never in plain text).
2. **Import the CSV roll** — immediately after account creation the user is
   sent to `upload.html` and must import a sheet with columns *Hostel Room
   Number, Name of the Student, Year of Study, Department* (header spelling
   is case-insensitive; a sample sheet is downloadable from that page and
   also lives at `sample-data/sample_students.csv`).
3. **Dynamic register** — `dashboard.html` renders one row per student,
   grouped/sorted by room, with a green/red toggle switch for present/absent.
   The toggle is a visual reference only, as requested — flipping it just
   flips a boolean flag on that student's record.
4. **Rearrange** — buttons above the table re-sort by Room Number,
   Department, or Year of Study (calls `GET /api/students?sort=...`).
5. **Report** — `report.html` shows present/absent pie charts for the whole
   hostel, and one chart per room, per department, and per year. A
   "Download / Print Report" link opens the browser's print dialog, which
   lets the user save the whole report (charts included) as a PDF.
6. **Sidebar add-entry with OTP** — the dashboard sidebar lets a user type an
   e-mail, request a one-time code (`POST /api/students/otp/request`, sent
   via Nodemailer), then supply the code plus the new student's details to
   `POST /api/students/otp/verify-and-add`. Codes are bcrypt-hashed at rest
   and expire after 10 minutes.

---

## 3. Running it locally

```bash
npm install
cp .env.example .env      # then edit .env — see below
npm run init-db           # creates database/hostel.db with empty tables
npm start                 # http://localhost:3000
```

### Configuring OTP e-mail delivery
Fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` in `.env`. For
Gmail, generate an **App Password** (Google Account → Security → App
Passwords) rather than using your normal password.

If SMTP isn't configured, the app still works for development: OTP codes are
printed to the server console instead of being e-mailed, so you can test the
flow before wiring up real e-mail.

---

## 4. Git-based "database"

The SQLite file at `database/hostel.db` is intentionally **not** excluded in
`.gitignore` — commit it like any other file:

```bash
git add database/hostel.db
git commit -m "Update attendance data"
git push
```

That means the current roll, attendance state, and user accounts travel with
the repo itself. A couple of practical notes worth knowing before you rely
on this in the real world:

- SQLite is a binary file, so git diffs on it aren't human-readable, and
  concurrent pushes from two people can conflict/overwrite each other's
  changes (last push wins, like any binary file in git). This is fine for a
  single-editor academic ledger use case; it is **not** a substitute for a
  proper multi-user database if several wardens need to edit at once.
- If you'd rather keep the database out of git (e.g. host it elsewhere and
  only version the code), just uncomment the `database/hostel.db` line in
  `.gitignore`.

---

## 5. Pushing to a new repository

```bash
cd hostel-attendance-app
git init
git add .
git commit -m "Initial commit: Hostel Attendance Register"
git branch -M main
git remote add origin <your-new-repo-url>
git push -u origin main
```

---

## 6. Security notes

- Passwords are hashed with bcrypt (`bcryptjs`), never stored in plain text.
- OTP codes are hashed before being stored and expire after 10 minutes.
- Sessions are httpOnly cookies (`express-session`); the default session
  store is in-memory, which is fine for a single small deployment but should
  be swapped for a persistent store (e.g. `connect-sqlite3`) if you expect
  the server process to restart often with users mid-session.
- `SESSION_SECRET` in `.env` should be a long random string in any real
  deployment — never reuse the placeholder from `.env.example`.
