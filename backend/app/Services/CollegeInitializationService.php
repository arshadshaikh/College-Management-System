<?php

namespace App\Services;

use App\Models\College;
use App\Models\Role;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CollegeInitializationService
{
    public function initialize(College $college): void
    {
        $this->seedRoles($college);
        $this->seedRolePrivileges($college);   // ← NEW: assign privileges to the roles
        $this->seedCmsPages($college);
        $this->seedSettings($college);
    }

    // ── 1. Roles ─────────────────────────────────────────────────
    private function seedRoles(College $college): void
    {
        $roles = [
            [
                'name'  => 'College Admin',
                'slug'  => 'college_admin',
                'scope' => 'college',
            ],
            [
                'name'  => 'Student',
                'slug'  => 'student',
                'scope' => 'student',
            ],
        ];

        foreach ($roles as $roleData) {
            Role::firstOrCreate(
                [
                    'slug'       => $roleData['slug'],
                    'college_id' => $college->id,
                ],
                [
                    'name'       => $roleData['name'],
                    'scope'      => $roleData['scope'],
                    'college_id' => $college->id,
                    'is_active'  => true,
                ]
            );
        }
    }

    // ── 2. Role → privilege assignment ──────────────────────────────
    // Single source of truth for what each tenant role can do.
    // Privilege ROWS are global (seeded once); here we link this
    // college's roles to them via the privilege_role pivot.
    private function seedRolePrivileges(College $college): void
    {
        // Privilege slugs each role slug should hold.
        // Keep this list in sync with the *PrivilegeSeeder classes.
        $map = [
            'college_admin' => [
                // Programs & fee structures
                'programs.index', 'programs.store', 'programs.show',
                'programs.update', 'programs.destroy', 'programs.fee-structures',
                // Applications (admin side)
                'applications.index', 'applications.show', 'applications.review',
                'applications.approve', 'applications.reject', 'documents.download',
                // Challans (admin side)
                'challans.index', 'challans.store', 'challans.show', 'challans.cancel',
                'challans.mark-paid', 'challans.pdf', 'payments.verify-slip', 'payments.slip',
                // CMS
                'settings.index', 'settings.update',
                // CMS pages
                'cms.pages.index', 'cms.pages.store', 'cms.pages.show',
                'cms.pages.update', 'cms.pages.destroy',
                // CMS announcements
                // college_admin: add all five
                'cms.announcements.index', 'cms.announcements.store', 'cms.announcements.show',
                'cms.announcements.update', 'cms.announcements.destroy',
                // CMS menus
                'cms.menus.index', 'cms.menus.store', 'cms.menus.show',
                'cms.menus.update', 'cms.menus.destroy',
                // CMS banners
                'cms.banners.index', 'cms.banners.store', 'cms.banners.show',
                'cms.banners.update', 'cms.banners.destroy',
                // CMS media
                'cms.media.index', 'cms.media.store', 'cms.media.show', 'cms.media.destroy',
                // Audit Logs
                'audit-logs.index',
            ],
            'student' => [
                'programs.index', 'programs.show',
                'applications.my', 'applications.store', 'applications.withdraw',
                'challans.my', 'challans.upload-slip', 'challans.pdf',
                'payments.slip',
                // CMS pages (students/public see only published)
                'cms.pages.index', 'cms.pages.show',
                // student: read-only
                'cms.announcements.index', 'cms.announcements.show',
                // CMS menus (student: read-only)
                'cms.menus.index', 'cms.menus.show',
                // CMS banners (student: read-only)
                'cms.banners.index', 'cms.banners.show',
                // CMS media (student: read-only)
                'cms.media.index', 'cms.media.show',
            ],
        ];

        foreach ($map as $roleSlug => $privilegeSlugs) {
            $role = Role::where('slug', $roleSlug)
                ->where('college_id', $college->id)
                ->first();

            if (!$role) {
                continue; // role wasn't created — shouldn't happen, seedRoles runs first
            }

            // Resolve the global privilege rows by slug.
            $privilegeIds = DB::table('privileges')
                ->whereIn('slug', $privilegeSlugs)
                ->pluck('id');

            foreach ($privilegeIds as $privId) {
                // privilege_role has NO updated_at (Lesson #4) — insertOrIgnore,
                // and check-before-insert keeps it idempotent on re-approval.
                $exists = DB::table('privilege_role')
                    ->where('role_id', $role->id)
                    ->where('privilege_id', $privId)
                    ->exists();

                if (!$exists) {
                    DB::table('privilege_role')->insert([
                        'role_id'      => $role->id,
                        'privilege_id' => $privId,
                        'created_at'   => Carbon::now(),
                        // NO updated_at — pivot doesn't have the column
                    ]);
                }
            }
        }
    }

    // ── 3. CMS pages ─────────────────────────────────────────────
    private function seedCmsPages(College $college): void
    {
        $pages = [
            ['title' => 'Home',       'slug' => 'home',       'sort_order' => 0],
            ['title' => 'About',      'slug' => 'about',      'sort_order' => 1],
            ['title' => 'Admissions', 'slug' => 'admissions', 'sort_order' => 2],
            ['title' => 'Contact',    'slug' => 'contact',    'sort_order' => 3],
        ];

        foreach ($pages as $page) {
            $exists = DB::table('cms_pages')
                ->where('college_id', $college->id)
                ->where('slug', $page['slug'])
                ->exists();

            if (!$exists) {
                DB::table('cms_pages')->insert([
                    'college_id'   => $college->id,
                    'title'        => $page['title'],
                    'slug'         => $page['slug'],
                    'content'      => "<h1>{$page['title']}</h1><p>Content coming soon.</p>",
                    'is_published' => true,
                    'sort_order'   => $page['sort_order'],
                    'created_at'   => Carbon::now(),
                    'updated_at'   => Carbon::now(),
                ]);
            }
        }
    }

    // ── 4. Settings ───────────────────────────────────────────────
    private function seedSettings(College $college): void
    {
        $settings = [
            ['key' => 'logo',           'value' => null,            'group' => 'branding'],
            ['key' => 'primary_color',  'value' => '#1e40af',       'group' => 'branding'],
            ['key' => 'contact_email',  'value' => $college->email, 'group' => 'contact'],
            ['key' => 'contact_phone',  'value' => $college->phone, 'group' => 'contact'],
            ['key' => 'admission_open', 'value' => 'false',         'group' => 'admission'],
            ['key' => 'allow_multiple_admissions', 'value' => 'false', 'group' => 'admissions'],
        ];

        foreach ($settings as $s) {
            $exists = DB::table('settings')
                ->where('college_id', $college->id)
                ->where('key', $s['key'])
                ->exists();

            if (!$exists) {
                DB::table('settings')->insert([
                    'college_id' => $college->id,
                    'key'        => $s['key'],
                    'value'      => $s['value'],
                    'group'      => $s['group'],
                    'created_at' => Carbon::now(),
                    'updated_at' => Carbon::now(),
                ]);
            }
        }
    }
}