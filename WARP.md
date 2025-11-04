# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands

- Install deps: `npm install`
- Run backend only (Express + SQLite): `npm run server`
- Run frontend only (Vite dev server): `npm run dev`
- Run both (concurrently for local dev): `npm run start`
- Build frontend (static assets in `dist/`): `npm run build`
- Preview built frontend: `npm run preview`
- Verify/inspect local SQLite DB: `node verify-db.js`

Notes
- No test or lint scripts are defined in `package.json`.

## Environment configuration

Backend (server.js uses dotenv)
- Required
  - `ADMIN_EMAIL` – seed admin login email
  - `ADMIN_PASSWORD` – seed admin password
  - `JWT_SECRET` – secret used to sign JWTs
  - `ENCRYPTION_KEY` – 32-byte AES-256 key as 64-char hex (used to encrypt API keys)
- Optional
  - `DB_PATH` – path to SQLite DB file (default: `<repo>/users.db`)
  - `PORT` – server port (default: 3001)

Frontend
- `VITE_API_BASE` – base URL for API (e.g. `http://localhost:3001`); used by API calls and in dev via Vite proxy.

CORS
- `server.js` allows `http://localhost:5173` and a placeholder production origin; update as needed for deployment.

## High-level architecture

Overview
- Single repo containing a React (Vite) frontend and a Node/Express backend with a local SQLite database (`better-sqlite3`).

Backend (`server.js`)
- Auth
  - POST `/api/login` issues JWT on successful credential match (bcrypt-hashed passwords in DB). JWT carries `{ id, email, role }`; expiry 8h. `Authorization: Bearer <token>` is required for protected routes via `requireAuth()` middleware.
- Users
  - Tables initialized on startup. Default admin/user seeded from env/consts.
  - CRUD subset: list users, create user, delete user (protected).
- API keys
  - Stored encrypted at rest using AES-256-CBC (IV:payload hex format). Endpoints to list, add, mark used, reset, delete (protected). Decrypts on demand to call upstream.
- Apollo proxy
  - Proxies to Apollo People endpoints server-side to avoid browser CORS and to keep keys off the client:
    - POST `/api/apollo/bulk_match` – expects `{ apiKeyId, details: [...] }`
    - POST `/api/apollo/single_match` – expects `{ apiKeyId, first_name, last_name, organization_name? }`
- DB utilities
  - `verify-db.js` prints table presence and basic contents for troubleshooting.

Frontend (`src/`)
- Routing (`src/main.jsx`)
  - Routes: `/` (Login), `/app` (enrichment app), `/admin` (admin dashboard). Guarded via `ProtectedRoute`.
- Auth/UI
  - `Login.jsx` posts to `/api/login`, stores `{...user, token}` in `localStorage` and routes by role.
  - `ProtectedRoute.jsx` validates JWT presence/expiry client-side and enforces optional role.
- Enrichment workflow (`ApolloEnrichmentApp.jsx`)
  - Manages API keys (list/add/activate/reset/delete) via backend.
  - Reads Excel files with ExcelJS, enriches rows by calling backend Apollo proxy (bulk then fallback single), and exports results to Excel.
- Admin (`AdminPage.jsx`)
  - Lists users, creates, and deletes users (role-restricted) via backend.
- API helper (`src/api.js`)
  - Thin wrapper to call `${VITE_API_BASE}/...` with JSON and optional Bearer token.

## Development workflow

- Local dev: run `npm run start` to boot backend (on 3001 by default) and Vite dev server (on 5173). Vite proxy forwards `/api` to the backend.
- Build: `npm run build` builds the frontend; backend runs with Node (no build step).
- Database resets: delete `users.db` (or set `DB_PATH`) to reinitialize schema and default users on next server start.
