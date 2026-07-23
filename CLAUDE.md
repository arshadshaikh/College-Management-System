# College Management System — Multi-tenant SaaS

Multi-tenant college admission platform. Each college = a tenant on a subdomain
(uos.localhost, iba.localhost); main domain (localhost) = super admin only.

## Stack & environment
- Backend: Laravel 11, `backend/` — served by XAMPP Apache (port 80, wildcard
  vhost), NOT `artisan serve`. DB: MySQL `college-system` (NOT `colleges-system`).
- Frontend: `frontend/` — Vite 6 + React 19 + Router 7 + Tailwind 4 + axios +
  react-hot-toast. Dev on :3000, proxies /api to Apache with changeOrigin:false
  (preserves Host header so tenant resolution works in dev).
- Windows. Use `dir`/`del`; artisan one-liners with `$` break in cmd — use
  interactive tinker.

## Architecture rules (violations have caused real bugs — do not break)
1. Tenancy: `ResolveTenant` middleware resolves subdomain → `app('current_college')`.
   Models use `BelongsToTenant` trait (global scope + auto-fill college_id +
   hardened `resolveRouteBinding` that explicitly filters college_id).
2. RBAC is fail-closed: every API route needs a `privileges` row (api_route +
   method) or `CheckPrivilege` 403s. Super admin (`user_type='super_admin'`,
   `college_id=NULL`) bypasses CheckPrivilege but menus come ONLY from real
   privilege_role grants.
3. Menus = privilege rows with show_in_menu=true, frontend_route, parent_id
   nesting; NO api_route. Granted per role in MenuSeeder. Never grant menu rows
   of one role to another (super admin gets all FUNCTIONAL privileges only).
4. Roles are per-tenant: always query `slug + college_id`, never slug alone.
   Composite unique (slug, college_id). Same for program codes, cms page slugs.
5. `CollegeInitializationService` is the single source of truth for college
   setup (roles, role privileges via its map, CMS pages, settings). CollegeSeeder
   must call it — never duplicate its logic. New privileges/menus must be added
   to its seedRolePrivileges() map or newly approved colleges won't get them.
6. All seeders idempotent (firstOrCreate / check-before-insert).
   `privilege_role` pivot has NO updated_at column.
7. Files: student docs & payment slips → `private` disk (auth-only download,
   frontend fetches as arraybuffer blob). Banners/media/logos → `public` disk
   (storage:link, web-accessible URL).
8. Hierarchical policies via `PolicyService::resolve(platformKey, collegeKey,
   collegeId)`: platform setting (college_id NULL) with concrete value enforces
   platform-wide; 'college_choice' delegates to the college's own setting.
9. Audit: `AuditLog::record('action.name', $model, [context])` inside the same
   DB transaction as state changes (approve, mark-paid, verify, suspend...).
10. Cache: tenant lookup cached 1h under `tenant:{slug}`; bust with
    Cache::forget on suspend/update. Never cache negative lookups.

## Frontend conventions
- Shared `DataTable` (server-driven search/sort/paginate, per_page, CSV export,
  headerActions, filters). All list pages use it. Backend index() methods take
  search/sort_by/sort_dir/per_page with a WHITELISTED $sortable array and
  clamped per_page.
- Forms: unified create/edit component keyed on useParams id; Laravel 422
  errors map to per-field messages; errors clear on change.
- axios instance (`src/api.js`) has NO default Content-Type — axios must
  auto-detect (FormData → multipart). NEVER set Content-Type manually.
- Privilege-gate UI with `hasPrv(slug)` from AuthContext (/me supplies
  privileges + menu). Route guards via `PrivilegeRoute slug=...`.
- Downloads of private files: responseType 'arraybuffer', Blob typed from the
  response content-type, derive file extension from it.

## Design goals for new UI work
Clean, modern, responsive (mobile-friendly) Tailwind UI consistent with the
existing dashboard: rounded-xl cards, subtle shadows, indigo primary, status
pills, accessible contrast, loading/empty states on every async view, toasts
for outcomes, confirmation for destructive actions.

## Testing accounts (dev)
- Super admin: localhost:3000 — CNIC 0000000000000 / Admin1234
- UOS admin: uos.localhost:3000 — 1111111111111 / Admin1234
- IBA admin: iba.localhost:3000 — 3333333333333 / Admin1234
- UOS student: uos.localhost:3000 — 2222222222222 / Student1234

## Verification discipline
After any change: run the affected artisan command / hit the endpoint and
confirm. After adding routes: clear route cache. After adding privileges:
seed + re-init colleges + re-login (privileges load at /me). A feature isn't
done until exercised end to end.