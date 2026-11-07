# Project Handoff — Multi-tenant College Admission SaaS

Paste this into the first message of a new chat (or commit it as `docs/HANDOFF.md`) so Claude has full context.
Last updated: 7 Nov 2026.

## 1. What this is
Multi-tenant college-admission SaaS for ANY university. **Laravel 11 (PHP 8.2) + React 19 (Vite 6, React Router 7, Tailwind 4, axios, react-hot-toast).**
Shared-database/shared-schema tenancy. JWT auth with CNIC-based login. Fail-closed RBAC.

- Owner: Arshad (full-stack Laravel/React developer, Windows + XAMPP).
- Repo: `https://github.com/arshadshaikh/College-Management-System.git` (private), branch `main`, root has `backend/` and `frontend/`. **GitHub account that owns it: `arshadshaikh` (hotmail email).** A different GitHub login (`arshadalishaikh`) is NOT allowed to push — if a push returns 403, clear the saved Windows credential and sign in as `arshadshaikh`.
- Local (laptop 1): `D:\xampp-8.2\htdocs\College-Management-System`. Local (laptop 2, current): `E:\XAMPP-NOV-2025\htdocs\College-Management-System` (PHP 8.2.12, Node 24, Composer 2.9, Git 2.52).
- Live (cPanel): `https://developer.usindh.edu.pk/cms/` — project is a git clone at `~/public_html/cms/` (user `developer2021`, DB `developer2021_cms`).
- Last commit known pushed: `13ea8f3` (seeder fixes). A later commit "Add public programs page ..." was being committed/pushed when this handoff was written — verify with `git status` and `git log --oneline -3`; if uncommitted, commit these files: `ProgramController.php`, `SettingController.php`, `routes/api.php`, `frontend/src/App.jsx`, `frontend/src/pages/public/PublicPrograms.jsx`.

## 2. Status
**Live on server and verified:** auth, college onboarding, programs/applications, fee structures, students (+Excel import), CMS, public college sites, audit logs, path-mode tenancy, full challan redesign (4-copy landscape PDF), and the **policy toggles** (auto-generate first challan on approval; late fee = off/flat/per_week/per_month + amount + from_day_one/full_period; computed on-demand when a challan is viewed). Settings UI has a "Fees & Challans" section. SettingsBackfillSeeder, AdminCrudPrivilegeSeeder, DocumentTypePrivilegeSeeder have been run on the server.

**Done locally, NOT deployed to the server yet:** public **Programs** page (`/programs` on the college site; `GET /api/public/programs`; shows "Apply now" only when setting `admission_open` is `'true'`, otherwise "Admissions closed"). Needs the usual deploy: `git pull`, cache clears, rebuild frontend, upload. College admin must also add a CMS menu item with URL `/programs` for it to appear in the nav.

**Next major feature (design agreed, not started in code): M.Phil/PhD admission profile** — see section 6.

## 3. Deploy recipe (server)
1. `cd ~/public_html/cms && git pull origin main`
2. `cd backend` then any needed seeders (`php artisan db:seed --class=X`, answer `yes` to the production prompt; the `proc_open` message is harmless). `composer` is not on PATH: `php /opt/cpanel/ea-wappspector/composer.phar install --no-dev` only if composer.json changed.
3. `php artisan config:clear && php artisan cache:clear && php artisan route:clear`
4. Frontend is built LOCALLY, never on the server. In `frontend/` create `.env.production` (git-ignored, not on server) containing exactly:
   ```
   VITE_BASE_PATH=cms
   VITE_API_BASE_URL=https://developer.usindh.edu.pk/cms/api
   ```
   Run `npm run build`; `findstr /n "assets" dist\index.html` must show `/cms/assets/...`. Zip the CONTENTS of `dist` (`cd dist` then `tar -a -c -f ..\dist.zip *`), in cPanel File Manager delete old `assets/` + `index.html` in `public_html/cms/` (never touch `.htaccess`, `backend/`), upload and extract the zip.
5. Do not edit code on the server. Server-only files: `backend/.env`, `public_html/cms/.htaccess`, built `index.html` + `assets/`. Never run `key:generate` on the server.

## 4. Local setup (new laptop) — what worked
- `backend/.env` from `.env.example`: `DB_DATABASE=college-system` (create empty DB in phpMyAdmin, utf8mb4_unicode_ci), `DB_CONNECTION=mariadb`, `TENANT_MODE=subdomain`; `php artisan key:generate`; `php artisan jwt:secret` (answer yes); `php artisan migrate --seed`; `php artisan storage:link`; `composer install`; enable php.ini extensions gd, zip, mbstring, openssl, pdo_mysql, fileinfo, intl.
- Apache vhost (first active vhost in `apache/conf/extra/httpd-vhosts.conf`): `ServerName localhost`, `ServerAlias *.localhost`, `DocumentRoot .../backend/public`, `AllowOverride All`, `Require all granted`, plus an `Alias /phpmyadmin` block so phpMyAdmin still works.
- Frontend: `npm install` then `npm run dev` (port 3000; vite proxies `/api` to Apache :80 and preserves the Host header so the tenant resolves from the subdomain). No frontend `.env` is needed for dev.
- Local URLs: `http://localhost:3000` = platform login; `http://uos.localhost:3000` = college "uos" (named "Example College"). Super admin: CNIC `0000000000000`, password `Admin1234` (seeded; change before real use). On the live server the college-admin login URL is `/cms/<college-slug>/login` (e.g. `/cms/uos/login`); `/cms/login` is only for the super admin.
- Windows git: if commit says identity unknown, set `git config --global user.name/user.email` to the repo account's email. `npm install` may modify `frontend/package-lock.json` — do NOT commit that; `git restore` it.

## 5. Architecture rules (breaking these caused real bugs)
- **RBAC is fail-closed.** Every API route needs a `privileges` row or `CheckPrivilege` returns 403. `CheckPrivilege` normalizes every route param to `{id}`. The FRONTEND also guards pages with `PrivilegeRoute slug="..."` / `hasPrv('...')` in `App.jsx` — those slugs must exist as privileges AND be granted to the role, or the page shows "Access Denied".
- Privileges and menus load at login (`/me`); new grants need a fresh login.
- **Every privilege must live in a seeder registered in `DatabaseSeeder`, never only in tinker/UI.** A fresh install exposed three gaps that had been fixed by hand on the old laptop: (1) legacy-style slugs `user-list, create-user, update-user, role-list, create-role, update-role, privilege-list, create-privilege, update-privilege` (+ view-/assign-/privilege-group-* ones) → `AdminCrudPrivilegeSeeder` existed but was not registered; (2) `doc-types.index/store/update/destroy` had no seeder → added `DocumentTypePrivilegeSeeder`. When adding a new page, check its `PrivilegeRoute`/`hasPrv` slug exists in a seeder.
- `CollegeInitializationService::seedRolePrivileges` `$map` is the source of truth for new-college role grants; `*PrivilegeSeeder` classes grant to existing roles.
- Super admin (`user_type='super_admin'`, `college_id` NULL) bypasses `CheckPrivilege` on the backend, but menus and frontend guards come from `privilege_role` grants. `MenuSeeder::grantAllToSuperAdmin` must filter `whereNotNull('api_route')`. `privilege_role` has no `updated_at`.
- Students are `users` (`user_type='student'`) + `StudentProfile`; no students table.
- Settings are key/value rows in `Setting` keyed by `college_id` (BelongsToTenant). **Real key names matter: `admission_open` (singular), `allow_multiple_admissions`, `auto_generate_challan`, `late_fee_mode`, `late_fee_amount`, `late_fee_partial`, `primary_color`, `logo`, `contact_email`, `contact_phone`; platform row `multiple_admissions_policy`.** `SettingController@publicIndex` whitelists which keys the public site can read (`logo, primary_color, contact_email, contact_phone, admission_open`). `PolicyService::resolve/allows` resolves platform-vs-college policies. `SettingsBackfillSeeder` ensures every college has every expected key (keep in sync with `seedSettings`).
- Public routes are in the `['tenant','throttle:60,1']` group (no `tenant.scope`) — filter by `app('current_college')->id` explicitly.
- Tenancy is mode-aware: `TENANT_MODE=subdomain` locally, `path` on server (frontend sends `X-College`; React Router basename absorbs the slug).
- Challan = container of `challan_items` (fee/discount/late_fee/conditional; negative = discount). `total_amount` = SUM(items) via `recomputeTotal()`. Late fee computed on demand in `ChallanController@show` (`ChallanService::applyLateFee`), one `late_fee` item (sort_order 999), not a scheduled job (host disables `proc_open`).
- Migration `2026_08_25_000001.php` has a non-standard name. Do not rename.
- PDF: DomPDF cannot keep 4 table cells in a row; the challan uses absolutely-positioned copies on a landscape page. mpdf is the fallback.

## 6. Admission-profile feature — design agreed, code not started
Existing code facts:
- `student_profiles`: user_id, college_id, registration_no, father_name (required), cnic, date_of_birth, gender, nationality, religion, permanent_address, emergency_contact, and FLAT `matric_*` / `inter_*` columns (marks, board, year).
- `documents`: college_id, application_id (required), student_id, `document_type` = fixed ENUM (cnic, matric_certificate, inter_certificate, domicile, photo, character_certificate, other), file fields, verification_status/notes/verified_by/at. Model hides `stored_path`, exposes `url` via route `documents.download`.
- `required_document_types` (super-admin configurable): scope, name, slug, is_mandatory, allowed_mime_types, max_size_kb, max_dimension, is_active, sort_order. The enum and this table are NOT linked.
Plan:
1. Add nullable columns to `student_profiles`: mobile, domicile province/district, PRC number, marital status, present address. Keep old matric/inter columns for now (migrate data and drop in a later careful step).
2. New `student_educations` table: one row per level (level slug, board/institution, roll no, year, total & obtained marks, grade/CGPA, optional certificate document). Which levels a college requires comes from a college setting, not code.
3. Make `documents.application_id` nullable and change `document_type` from enum to string holding the `required_document_types` slug, so profile documents (photo, CNIC, certificates) belong to the student and are reused across applications.
4. Applicant profile form (step-by-step, save as you go, completeness indicator); admin sees the full profile on the application detail page; optional policy "require complete profile before applying" as a college setting.
5. Point the public programs page "Apply now" at the proper applicant flow (currently goes to `/login`).
Files still needed from the owner before coding (paste output as text): `type app\Http\Controllers\ApplicationController.php`, `type app\Http\Controllers\RequiredDocumentTypeController.php`, `type database\migrations\2026_07_29_081932_create_required_document_types_table.php`, `type database\migrations\2026_07_31_202519_add_file_rules_to_required_document_types.php`, `type ..\frontend\src\pages\student\ApplyForm.jsx` (run from `backend`). Also useful: a screenshot of the University of Sindh admission-portal profile form that the design is modeled on.

## 7. Design principle and working style (from the owner)
- Product is for ANY university: configure DATA (document types, levels, policies, fee rules) in the DB, controllable from settings; keep LOGIC in code; abstract structure only when a second real case appears. Build one feature to polished before the next.
- **One step at a time, then wait for pasted output.** Keep steps small. Work and test on the LOCAL laptop; the server is only for deploying finished, pushed work.
- **File attachments reach Claude empty** — owner must paste code/output inline (or paste `type file` output as text). Screenshots work.
- Windows `cmd` mangles `php artisan tinker --execute`; use interactive `php artisan tinker`, one line at a time, chained `->` calls on one line.
- Recurring bugs: editing a file but not saving it (verify with `findstr /n`); React hooks/state placed outside the component; paginated endpoint `.map()` needs `data.data ?? data`; guessing a setting/slug name instead of checking it (use the real keys above).
- Server: `proc_open` disabled; `artisan about` and composer post-scripts print harmless errors; `throttle:5,1` login limiter uses DB cache (reset with `php artisan cache:clear`). Deploy docs: `docs/deploy/DEPLOY.md`.

## 8. Backlog
Admission-profile feature (above) → then: edit-in-place UI for challan items (PUT endpoint exists), re-add QR to challan PDF, manual-challan conditional-fee UI, public site: programs fee display, CMS rich-text/multi-banner, per-tenant favicon/title, rate-limit tuning, change seeded `Admin1234`, JWT TTL, audit coverage, near-zero test coverage, fix the 401 redirect that drops the `/cms` base path (goes to site-root `/login` → 404), college name still "Example College" for slug `uos`, programs list "Student" column shows "…", `groups` inconsistency `admission` vs `admissions` in settings (cosmetic), LMS as a separate future phase.
