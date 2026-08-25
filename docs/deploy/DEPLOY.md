# Deployment Guide — Subdirectory Hosting with Path-Based Tenancy

This app runs in two tenancy modes from **one codebase**, selected by config:

- **Subdomain mode** (local dev default): tenant college is read from the
  hostname, e.g. `uos.localhost`.
- **Path mode** (this deployment): tenant college is read from the URL path
  under a subdirectory, e.g. `https://developer.usindh.edu.pk/cms/uos`.

Local development is **untouched** by the path-mode setup — every path-mode
switch is driven by an env var or build var that is simply absent locally.

---

## 1. How path mode works (the moving parts)

| Concern | Subdomain mode (local) | Path mode (server) |
|---|---|---|
| Backend tenant detection | `ResolveTenant` reads host | `ResolveTenant` reads `X-College` header (`config('tenant.mode')==='path'`) |
| Frontend sends tenant | not needed | `api.js` sends `X-College: <slug>` |
| Frontend detects tenant | `config/tenant.js` from hostname | `config/tenant.js` from `/cms/<slug>` path |
| React Router basename | `''` | `/cms` or `/cms/<slug>` (main.jsx) |
| Vite base | `/` | `/cms/` |
| API base URL | `/api` (dev proxy) | `https://.../cms/api` |
| Laravel route matching | URI as-is | `index.php` strips `/cms` prefix |

The key trick: in path mode the React Router **basename absorbs the college
slug** (`/cms/uos`), so in-app routes are identical to subdomain mode
(`/cms/uos` -> in-app `/` -> home; `/cms/uos/about` -> `/about`).

---

## 2. Config that drives it

**Backend `.env` (server only):**
```
APP_ENV=production
APP_DEBUG=false
APP_TIMEZONE=Asia/Karachi
APP_URL=https://developer.usindh.edu.pk/cms
FRONTEND_URL=https://developer.usindh.edu.pk/cms
TENANT_MODE=path
# APP_KEY: keep the key the DB was encrypted with — do NOT run key:generate
```

**Web-root `.htaccess`** (server only, at `public_html/cms/.htaccess`):
see `cms.htaccess.example` in this folder. Provides:
- `SetEnv APP_BASE_PATH /cms`  ← read by `index.php` (see below)
- SPA + API rewrites

**`backend/public/index.php`** (tracked in git) reads the prefix from the
**server environment**, not Laravel's env loader:
```php
$basePath = $_SERVER['APP_BASE_PATH'] ?? '';
```
> Why `$_SERVER` and not `env()`? At the `index.php` entry point the `.env`
> file hasn't been loaded yet on a web request (it loads later, during
> framework boot), so `env('APP_BASE_PATH')` returns empty there. The value
> set by Apache `SetEnv` **is** present in `$_SERVER`/`getenv()` at that point.
> (It worked in `php artisan tinker` only because the console kernel fully
> boots and loads `.env` before the command runs.)

**Frontend build vars** — `frontend/.env.production` (local, read at build):
```
VITE_BASE_PATH=cms
VITE_API_BASE_URL=https://developer.usindh.edu.pk/cms/api
```
`vite.config.js` reads these via `loadEnv()` (NOT `process.env`, which does not
see `.env` files).

---

## 3. Update workflow (code change -> live)

**Backend or shared code change:**
1. Commit + push from **local**.
2. On server: `cd ~/public_html/cms && git pull`
3. If a tracked file you hand-edited on the server blocks the pull:
   `git checkout <that-file>` first, then `git pull`.
4. If config/env changed: `cd backend && php artisan config:clear`

**Frontend change (must rebuild — server never builds React):**
1. Edit source **locally**.
2. `cd frontend && npm run build`  (reads `.env.production`)
3. Verify `frontend/dist/index.html` asset paths start with `/cms/assets/...`
   (if they say `/assets/...`, the base path didn't apply — check
   `.env.production` and that `vite.config.js` uses `loadEnv`).
4. Upload: zip the **contents** of `dist/` (index.html + assets/ at top level),
   upload to `public_html/cms/`, extract there, delete the zip.
   Delete the OLD `assets/` folder and `index.html` first so no stale hashed
   bundles linger.

---

## 4. First-time server setup (from scratch)

1. Clone the repo into the web-root subdirectory (`public_html/cms/`).
2. `composer install` in `backend/` (or ensure `vendor/` present).
3. Create `backend/.env` as in section 2 (keep the DB's original `APP_KEY`).
4. Import/point the DB (already populated — no migrate/seed needed here).
5. Create `public_html/cms/.htaccess` from `cms.htaccess.example`.
6. `cd backend && php artisan config:clear && php artisan storage:link`
7. Build frontend locally (section 3) and upload `dist/` to `public_html/cms/`.
8. Test in order:
   - `/cms/api/app-config` -> JSON  (API + prefix strip)
   - `/cms/` -> platform SPA
   - `/cms/<slug>` -> that college's site  (path tenancy)
   - login + a portal page

---

## 5. Gotchas found during deployment

- **`env()` is empty at `index.php` entry point on web requests** — use
  `$_SERVER['APP_BASE_PATH']` (set via `SetEnv`). See section 2.
- **Vite `base` didn't apply** — `vite.config.js` must read the build var via
  `loadEnv(mode, cwd, '')`, not `process.env` (Vite doesn't put `.env` files
  into `process.env`).
- **College slug leaked as a page slug** (`/cms/uos` fetched `pages/uos`, 404)
  — fixed by folding the slug into the Router `basename` in `main.jsx`.
- **Stale JS after re-upload** — delete old `assets/` before extracting the new
  build; bundle filenames are content-hashed and change each build.
- **favicon** — `index.html` hard-codes `/favicon.svg` (loads from domain root,
  not `/cms`). Cosmetic; fix later by making it `/cms/favicon.svg` or moving
  the favicon.
- **Login rate limit** (`throttle:5,1`, DB cache) can trip during rapid testing
  -> HTTP 429. Reset with `php artisan cache:clear`.

---

## 6. Files that are server-only (NOT in git) — keep safe

- `backend/.env` (secrets, DB creds, APP_KEY)
- `public_html/cms/.htaccess` (documented copy: `cms.htaccess.example`)
- `frontend/dist/` on the server (build artifact; source of truth is local build)
