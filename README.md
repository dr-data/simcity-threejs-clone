# Classroom SimCity

A classroom-friendly, cloud-hosted city-building game built on the open-source [SimCity Three.js clone](https://github.com/dgreenheck/simcity-threejs-clone). Designed for **15–20 minute in-class activities** with login, leaderboards, and an admin panel for teachers.

## Learning Objectives

Students explore urban planning trade-offs through gameplay:

- **Zoning balance** — residential vs commercial vs industrial
- **Infrastructure** — power plants, roads, basic services
- **Disaster resilience** — preparing for and responding to random disasters
- **Trade-offs** — growth vs sustainability vs safety

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (Frontend)                                │
│  Vite + Three.js — game, login, leaderboard, admin UI       │
└──────────────────────────┬──────────────────────────────────┘
                           │ /api/* (credentials: include)
┌──────────────────────────▼──────────────────────────────────┐
│  Cloudflare Worker (API)                                    │
│  Auth, scores, leaderboard, admin endpoints                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Cloudflare D1 (SQLite)                                     │
│  users, player_stats, game_sessions, admin_audit_log        │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Modules

| Module | Purpose |
|--------|---------|
| `SessionManager` | Timed sessions, scoring, milestones, end screen |
| `DisasterManager` | Random disasters, visual effects, zone damage |
| `CameraManager` | Top / isometric / street / orbit views + touch |
| `BudgetManager` | Building costs and GOD mode free build |
| `CheatConsole` | Teacher cheat commands (`/`, console button) |
| `SaveLoadManager` | localStorage city save/load |
| `cityTemplates` | Pre-built city scenarios |
| `authClient` | API client for auth and scores |

### Backend Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/signup` | — | Create account |
| `POST /api/auth/login` | — | Login (httpOnly session cookie) |
| `POST /api/auth/logout` | — | Clear session |
| `POST /api/auth/reset-request` | — | Password reset request |
| `POST /api/auth/reset` | — | Complete password reset |
| `GET /api/me` | User | Profile + stats |
| `POST /api/scores` | User | Submit session results |
| `GET /api/leaderboard` | — | Public rankings |
| `GET /api/admin/users` | Admin | List players |
| `PUT /api/admin/users/:id` | Admin | Edit stats |
| `DELETE /api/admin/users/:id` | Admin | Delete / soft-delete |
| `POST /api/admin/leaderboard/reset` | Admin | Clear all rankings |
| `POST /api/admin/leaderboard/hide` | Admin | Toggle visibility |
| `GET /api/admin/audit-log` | Admin | Admin action history |
| `GET /api/admin/sessions` | Admin | Recent game sessions |

### Data Model (D1)

- **users** — id, username, email, password_hash, password_salt, is_admin, is_active
- **player_stats** — per-user bests and total_sessions
- **game_sessions** — per-play session records
- **admin_audit_log** — admin changes with old/new values
- **password_reset_tokens** — reset flow
- **app_settings** — e.g. leaderboard_hidden

### Auth Choice

We use **Cloudflare Workers + D1** with PBKDF2 password hashing and signed httpOnly session cookies. This keeps ops minimal (no Auth0/Clerk subscription) and fits classroom scale. Sessions are HMAC-signed tokens in cookies — not JWTs stored in localStorage.

---

## Local Development

### Prerequisites

- Node.js 18+
- Cloudflare account (for Worker/D1 deploy)

### Frontend only

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3000

### Frontend + Worker (full stack)

```bash
npm install

# Create local D1 and run migrations
npx wrangler d1 create classroom-simcity   # copy database_id to wrangler.toml
npm run db:migrate:local

# Seed admin user
npm run seed-admin
npx wrangler d1 execute classroom-simcity --local --file=worker/seed-output.sql

# Set secrets for local dev
npx wrangler secret put SESSION_SECRET   # use a long random string

# Start Worker (port 8787) and frontend (port 3000)
npx wrangler dev &
npm run dev
```

Vite proxies `/api` to the Worker in dev mode.

### Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `VITE_API_URL` | Pages build | Worker URL (empty = same-origin `/api` proxy) |
| `VITE_GAME_CONFIG` | Pages build | JSON override for teacher settings |
| `SESSION_SECRET` | Worker secret | HMAC signing key for sessions |
| `ALLOWED_ORIGIN` | wrangler.toml | CORS origin for Pages domain |
| `DEV_MODE` | wrangler.toml | `true` returns reset tokens in API response |

Example teacher config:

```bash
VITE_GAME_CONFIG='{"sessionLengthMinutes":20,"disasterFrequencyMax":2,"allowGodMode":false}'
```

---

## Cloudflare Deployment

### 1. Create D1 database

```bash
npx wrangler d1 create classroom-simcity
```

Copy the `database_id` into `wrangler.toml`.

### 2. Run migrations

```bash
npm run db:migrate
```

### 3. Create first admin user

```bash
npm run seed-admin teacher mySecurePassword teacher@school.edu
npx wrangler d1 execute classroom-simcity --file=worker/seed-output.sql
```

Default seed (if no args): `admin` / `classroom123` — **change immediately**.

### 4. Set secrets

```bash
npx wrangler secret put SESSION_SECRET
```

Update `ALLOWED_ORIGIN` in `wrangler.toml` to your Pages URL.

### 5. Deploy Worker

```bash
npm run worker:deploy
```

Note the Worker URL (e.g. `https://classroom-simcity-api.<account>.workers.dev`).

### 6. Deploy Pages

```bash
VITE_API_URL=https://classroom-simcity-api.<account>.workers.dev npm run build
npx wrangler pages deploy dist --project-name=classroom-simcity
```

Or connect GitHub and use the included `.github/workflows/cloudflare.yml` with secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_API_URL` (GitHub variable)

### 7. Add additional admins

```bash
npm run seed-admin newadmin password email@school.edu
npx wrangler d1 execute classroom-simcity --file=worker/seed-output.sql
```

Or set `is_admin = 1` in D1 for an existing user.

---

## Teacher & Admin Guide

### Setting Up a Class Session

1. Deploy the app and create an admin account.
2. Share the game URL with students; have them **sign up** on the login page.
3. Use **Quick Start**: `?quick=1` loads the Small Town template with tutorial.
4. Default session is **15 minutes** — adjust via `VITE_GAME_CONFIG` or `gameConfig.js`.
5. After sessions end, open **Leaderboard** for class discussion.

### Using the Admin Panel

1. Log in as admin → click **Admin** in the nav (or go to `/admin.html`).
2. **View players** — search, sort, see all stats.
3. **Edit stats** — click a row, adjust values, save (logged in audit).
4. **Reset stats** — zero out a single player's scores.
5. **Soft delete** — hide from leaderboard without removing account.
6. **Delete** — permanently remove account and stats.
7. **Reset All Rankings** — clear entire leaderboard (with confirmation).
8. **Toggle Leaderboard** — hide during live events.
9. **Sessions** — view/delete suspicious test runs.
10. **Audit Log** — review all admin actions.

### Suggested Discussion Questions

- Why did you place industrial zones away from residential areas?
- How did power constraints affect your growth strategy?
- What changed after the first disaster?
- Would you prioritize more residents or higher resilience? Why?

### Interpreting Stats

| Stat | Meaning |
|------|---------|
| **Score** | Residents×2 + zones×15 + resilience×3 + disaster bonus |
| **Residents** | People housed (damaged zones don't count) |
| **Resilience** | % of RCI zones not currently damaged |
| **Sessions** | Total completed games |

---

## Cheat Codes (Teachers)

Press `/` or click **Console**. Commands:

| Command | Effect |
|---------|--------|
| `help` | List commands |
| `zone residential 10` | Place 10 residential zones |
| `zone commercial 5` | Place commercial zones |
| `zone industrial 5` | Place industrial zones |
| `powerplants 2` | Place power plants |
| `god on` / `god off` | Toggle unlimited resources |
| `template small-town` | Load city template |
| `template industrial` | Industrial hub template |
| `template balanced` | Balanced city template |
| `budget 10000` | Set budget |
| `disaster` | Trigger disaster immediately |

### City Templates

- **blank** — empty grid
- **small-town** — balanced starter (Quick Start default)
- **industrial** — industrial hub scenario
- **balanced** — equal RCI mix

Load via dropdown or cheat command.

---

## Game Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Build | Left click | Tap tool, tap tile |
| Rotate | Right drag | Touch drag |
| Pan | Ctrl + right drag | — |
| Zoom | Scroll | Pinch (browser) |
| Pause | Toolbar | Toolbar |
| Views | Top / Iso / Street / Orbit | Same buttons |
| Cheats | `/` key | Console button |

---

## Extending the Game

- **New disasters** — add types in `disasterManager.js` with colors and messages
- **New zone types** — extend `buildingFactory.js` and templates
- **Class codes** — add `class_code` column to users; filter leaderboard by class
- **Faster sim** — adjust `setInterval` in `game.js` or development config in `config.js`

---

## License

MIT — based on the original SimCity Three.js clone. See [LICENSE](LICENSE).

## Original Project

Built from [simcity-threejs-clone](https://github.com/dgreenheck/simcity-threejs-clone) by Daniel Greenheck.
