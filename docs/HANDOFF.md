# Project Handoff — Multi-tenant College Admission SaaS

Paste this into the first message of a new chat (or commit it as `docs/HANDOFF.md`) so Claude has full context.
Last updated: 10 Nov 2026.

## 1. What this is
Multi-tenant college-admission SaaS for ANY university. **Laravel 11 (PHP 8.2) + React 19 (Vite 6, React Router 7, Tailwind 4, axios, react-hot-toast).**
Shared-database/shared-schema tenancy. JWT auth with CNIC-based login. Fail-closed RBAC.

- Owner: Arshad (full-stack Laravel/React developer, Windows + XAMPP).
- Repo: `https://github.com/arshadshaikh/College-Management-System.git` (private), branch `main`, root has `backend/` and `frontend/`. **GitHub account that owns it: `arshadshaikh` (hotmail email).** A different GitHub login (`arshadalishaikh`) is NOT allowed to push — if a push returns 403, clear the saved Windows credential and sign in as `arshadshaikh`.
- Local (laptop 1): `D:\xampp-8.2\htdocs\College-Management-System`. Local (laptop 2, current): `E:\XAMPP-NOV-2025\htdocs\College-Management-System` (PHP 8.2.12, Node 24, Composer 2.9, Git 2.52).
- Live (cPanel): `https://developer.usindh.edu.pk/cms/` — project is a git clone at `~/public_html/cms/` (user `developer2021`, DB `developer2021_cms`).
- Last commit pushed and deployed: `48ab21c` (public programs page). Earlier: `13ea8f3` (seeder fixes). Server code and built frontend are both at this state.

## 2. Status
**Live on server and verified:** auth, college onboarding, programs/applications, fee structures, students (+Excel import), CMS, public college sites, audit logs, path-mode tenancy, full challan redesign (4-copy landscape PDF), and the **policy toggles** (auto-generate first challan on approval; late fee = off/flat/per_week/per_month + amount + from_day_one/full_period; computed on-demand when a challan is viewed). Settings UI has a "Fees & Challans" section. SettingsBackfillSeeder, AdminCrudPrivilegeSeeder, DocumentTypePrivilegeSeeder have been run on the server.

**Also live (deployed 7 Nov 2026, verified):** public **Programs** page (`/programs` on the college site; `GET /api/public/programs`; shows "Apply now" only when setting `admission_open` is `'true'`, otherwise "Admissions closed"). A college admin must still add a CMS menu item with URL `/programs` for it to appear in the nav.

**Done locally but not deployed:** admission-profile work (section 6). GitHub and the server are still at `48ab21c`.

**In progress locally (NOT pushed/deployed): M.Phil/PhD admission profile** — see section 6 "Progress". Local commits after `48ab21c`, starting `dd44ec8`.

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
- Local URLs: `http://localhost:3000` = platform login; `http://uos.localhost:3000` = college "uos" (now named "University of Sindh"). Super admin: CNIC `0000000000000`, password `Admin1234` (seeded; change before real use). On the live server the college-admin login URL is `/cms/<college-slug>/login` (e.g. `/cms/uos/login`); `/cms/login` is only for the super admin.
- Windows git: if commit says identity unknown, set `git config --global user.name/user.email` to the repo account's email. `npm install` may modify `frontend/package-lock.json` — do NOT commit that; `git restore` it.

## 5. Architecture rules (breaking these caused real bugs)
- **RBAC is fail-closed.** Every API route needs a `privileges` row or `CheckPrivilege` returns 403. `CheckPrivilege` only normalizes NUMERIC path segments to `{id}` (`preg_replace("#/\d+#", "/{id}")`); a text param like a slug never matches, so pass slugs in the body/query, not the path. The FRONTEND also guards pages with `PrivilegeRoute slug="..."` / `hasPrv('...')` in `App.jsx` — those slugs must exist as privileges AND be granted to the role, or the page shows "Access Denied".
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

## 6. Admission-profile feature — built locally (not pushed/deployed)
Existing code facts:
- `student_profiles`: user_id, college_id, registration_no, father_name (required), cnic, date_of_birth, gender, nationality, religion, permanent_address, emergency_contact, and FLAT `matric_*` / `inter_*` columns (marks, board, year).
- `documents`: college_id, application_id (required), student_id, `document_type` = fixed ENUM (cnic, matric_certificate, inter_certificate, domicile, photo, character_certificate, other), file fields, verification_status/notes/verified_by/at. Model hides `stored_path`, exposes `url` via route `documents.download`.
- `required_document_types` (super-admin configurable): scope, name, slug, is_mandatory, allowed_mime_types, max_size_kb, max_dimension, is_active, sort_order. The enum and this table are NOT linked.
(The facts above describe the code BEFORE this feature; see Progress for what changed.)

### Progress (as of 10 Nov 2026, local laptop 2, committed locally, not pushed)
Done and tested:
- `student_profiles` + domicile_province/district, prc_no, marital_status, present_address (mobile dropped: `users.phone` is the mobile).
- `student_educations` table + `StudentEducation` model; `User::educations()`, `User::profileDocuments()` (documents with NULL application_id), `Document::scopeProfile()`.
- `config/admission.php` = education level catalog (matric, intermediate, bachelors, masters, mphil → label, certificate doc slug, marks/cgpa). College settings (group `admission`): `required_education_levels` (default `matric,intermediate`), `require_complete_profile` (default `true`). Both in seedSettings + SettingsBackfillSeeder.
- `documents.application_id` nullable, `document_type` now varchar(100) = `required_document_types.slug`. `StudentDocumentTypeSeeder` (scope `student_application`, 10 types) registered in DatabaseSeeder.
- API (ProfileController, tenant.scope group): GET/PUT `/api/profile`, PUT `/api/profile/educations` (level in BODY — CheckPrivilege only normalizes numeric segments), DELETE `/api/profile/educations/{id}`, POST `/api/profile/documents`, GET `/api/profile/documents/{id}/download`. Privileges `profile.show/update/educations.save/educations.destroy/documents.upload/documents.download` in `ProfilePrivilegeSeeder` (registered), `$map` student list, and StudentAuthController fallback list. Passing years must increase with level order.
- `App\Services\ApplicantProfileService` = completeness + requiredLevels + requiresCompleteProfile.
- Frontend: `pages/student/MyProfile.jsx` (+ `profile/EducationSection.jsx`, `profile/DocumentsSection.jsx`), route `my-profile` (slug profile.show), menu `menu.student.profile` (MenuSeeder + $map). Admin: `pages/college-admin/ApplicantProfile.jsx` on ApplicationDetail; `ApplicationController@show` also returns `education_levels` + `document_types`.
- Apply: `ApplicationController@store` no longer takes doc_* files; gated by `require_complete_profile`; `ApplyForm.jsx` rewritten (profile banner, no uploads).
- Test student: CNIC 4210112345671 / Test1234 (college uos). Programs 1 MS Data Science, 2 BS Computer Science.
- Settings UI (`Settings.jsx` + `SettingController` index/update) exposes `require_complete_profile` toggle and `required_education_levels` checkboxes (index returns `education_levels` catalog).
- Per-program extra levels: `programs.required_education_levels` (nullable CSV, EXTRA levels on top of the college baseline). ProgramController validates it; `ProgramForm.jsx` shows baseline ticked/disabled + extra checkboxes (DEGREE_LABELS map for select text). `ApplicantProfileService::completeness($user, $collegeId, $extraLevels = [])`; `ApplicationController@store` passes the program's levels, so MS Data Science (extra = bachelors) blocks applicants without Bachelor's. Tested.
- Note: My Profile page shows the college baseline only; program extras surface on the Apply page banner (422 completeness).
- College-level applicant documents (commit ba1eb1f): table `college_document_types` (college_id, required_document_type_id, is_active, is_required) + model `CollegeDocumentType`. Super admin keeps the master list (Document Types, scope `student_application`); each college picks Required / Optional / Not asked in **Settings → Admissions → Applicant Documents** (SettingController index returns `document_types`, update accepts `document_types[]`; no new privileges). No row = master is_active/is_mandatory. Education certificates (config/admission.php `document`) ignore college choices and follow required levels. `ApplicantProfileService::documentTypes($collegeId)` is the single source, used by ProfileController payload/upload and completeness. `PERSONAL_LABELS` gives readable "Still needed" names; payload returns `required_personal` so MyProfile marks them with *. Saving the profile with * fields empty is allowed by design; the apply gate enforces them.
- Student sign-up: `pages/auth/Register.jsx`, route `/register`, "Create an account" link on Login (college subdomains only). Calls POST /api/register then the normal login, lands on /portal/my-profile. One login page for all roles is kept (decided).
- Public "Apply now" (PublicPrograms.jsx): visitors → /register, logged-in → /portal/apply?program=ID; ApplyForm pre-selects ?program.
- College branding (commit 5b8bfcb): `/api/app-config` now runs through `tenant` middleware; on a college (not is_platform) it returns college name, Settings `primary_color` and `logo` (a Media Library public_url) as `logo_url`, `is_college: true`; main domain returns config('site.*'). `AppConfigContext` points Tailwind's `--color-indigo-50..800` CSS variables at the college colour (re-brands all pages) and sets document.title. `AppIcon` renders the logo when set. Settings → Branding has a LogoPicker (Media Library images; `settings.logo` validated to be this college's image). uos renamed to "University of Sindh" via tinker (College list has no edit yet).
- Student dashboard (`pages/student/StudentDashboard.jsx`, shown by Dashboard.jsx for applicants): 5-step checklist (account, profile, apply, decision incl. "returned" with note + Fix button, challan) + My applications card. Applicant = privileges `profile.show` + `applications.my` (not role names). Student program cards (`StudentPrograms.jsx`, App.jsx renders it on /programs for applicants): readiness per program, Applied badge, degree filter. Commit c7ebe25.
- My Profile tiles + clickable "Still needed" chips. Apply review step (ReviewCard + declaration, "Confirm & Submit"); programs already applied (not withdrawn/rejected) are disabled in the dropdown.
- Education dates: `config/admission.php` levels have `min_age` (matric 13, intermediate 15, bachelors 17, masters 19, mphil 21); ProfileController@saveEducation rejects passing year < birth year + min_age.
- Application snapshot: `applications.profile_snapshot` (json), `submitted_at`, `correction_note`, status enum + `returned`. Store/resubmit save `ApplicantProfileService::snapshot()`; show returns `profile_changes` (`changesSince()`). Admin ApplicantProfile shows green/amber banner + "As submitted | Current" toggle.
- Profile lock: `config('admission.lock_profile_statuses')` = under_review, shortlisted, approved. ProfileController `ensureEditable()` → 423 on update/education/upload; payload `locked`. MyProfile disables personal + education; Documents keep View, hide Upload/Replace.
- Return for correction: privileges `applications.return` (admin) and `applications.resubmit` (student) in ProgramPrivilegeSeeder, `$map` (CollegeInitializationService) and StudentAuthController fallback. Routes POST `/api/applications/{id}/return` (note required; from submitted/under_review/shortlisted) and `/resubmit` (own app, status returned, completeness gate, fresh snapshot → submitted). Admin `ReturnForCorrection` card on ApplicationDetail; student orange banner + Resubmit on MyProfile (payload `returned[]`); orange "Returned" badge in config/statuses.js, MyApplications, dashboard. Commit d66c711.
Remaining: certificates per level (agreed design: super admin links any number of document types to an education level, e.g. Pass + Marks certificate; colleges keep Required/Optional/Not asked; O Level / A Level as an equivalence choice on the Matric / Intermediate row, with grades instead of marks) → application status timeline + Withdraw button with confirmation → college name edit for super admin, sidebar icon for fa-user, "profile complete, you can apply" text while locked → deploy (migrations + SettingsBackfillSeeder, StudentDocumentTypeSeeder, ProfilePrivilegeSeeder, MenuSeeder, ProgramPrivilegeSeeder on server; build frontend locally).

## 7. Design principle and working style (from the owner)
- Product is for ANY university: configure DATA (document types, levels, policies, fee rules) in the DB, controllable from settings; keep LOGIC in code; abstract structure only when a second real case appears. Build one feature to polished before the next.
- **One step at a time, then wait for pasted output.** Keep steps small. Work and test on the LOCAL laptop; the server is only for deploying finished, pushed work.
- **File attachments reach Claude empty** — owner must paste code/output inline (or paste `type file` output as text). Screenshots work.
- Windows `cmd` mangles `php artisan tinker --execute`; use interactive `php artisan tinker`, one line at a time, chained `->` calls on one line.
- Recurring bugs: editing a file but not saving it (verify with `findstr /n`); React hooks/state placed outside the component; paginated endpoint `.map()` needs `data.data ?? data`; guessing a setting/slug name instead of checking it (use the real keys above).
- Server: `proc_open` disabled; `artisan about` and composer post-scripts print harmless errors; `throttle:5,1` login limiter uses DB cache (reset with `php artisan cache:clear`). Deploy docs: `docs/deploy/DEPLOY.md`.

## 8. Backlog
Admission-profile feature (above) → then: edit-in-place UI for challan items (PUT endpoint exists), re-add QR to challan PDF, manual-challan conditional-fee UI, public site: programs fee display, CMS rich-text/multi-banner, per-tenant favicon/title, rate-limit tuning, change seeded `Admin1234`, JWT TTL, audit coverage, near-zero test coverage, fix the 401 redirect that drops the `/cms` base path (goes to site-root `/login` → 404), programs list "Student" column shows "…", `groups` inconsistency `admission` vs `admissions` in settings (cosmetic), LMS as a separate future phase.