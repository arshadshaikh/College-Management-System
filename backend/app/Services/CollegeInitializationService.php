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
        \App\Models\FeeType::seedDefaults($college->id);   // starter fee types (Settings -> Fees & Challans)
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
        // $map = [
        //     'college_admin' => [
        //         // Programs & fee structures
        //         'programs.index', 'programs.store', 'programs.show',
        //         'programs.update', 'programs.destroy', 'programs.fee-structures',
        //         // Applications (admin side)
        //         'applications.index', 'applications.show', 'applications.review',
        //         'applications.approve', 'applications.reject', 'documents.download',
        //         // Challans (admin side)
        //         'challans.index', 'challans.store', 'challans.show', 'challans.cancel',
        //         'challans.mark-paid', 'challans.pdf', 'payments.verify-slip', 'payments.slip',
        //         // CMS
        //         'settings.index', 'settings.update',
        //         // CMS pages
        //         'cms.pages.index', 'cms.pages.store', 'cms.pages.show',
        //         'cms.pages.update', 'cms.pages.destroy',
        //         // CMS announcements
        //         // college_admin: add all five
        //         'cms.announcements.index', 'cms.announcements.store', 'cms.announcements.show',
        //         'cms.announcements.update', 'cms.announcements.destroy',
        //         // CMS menus
        //         'cms.menus.index', 'cms.menus.store', 'cms.menus.show',
        //         'cms.menus.update', 'cms.menus.destroy',
        //         // CMS banners
        //         'cms.banners.index', 'cms.banners.store', 'cms.banners.show',
        //         'cms.banners.update', 'cms.banners.destroy',
        //         // CMS media
        //         'cms.media.index', 'cms.media.store', 'cms.media.show', 'cms.media.destroy',
        //         // Audit Logs
        //         'audit-logs.index',
        //     ],
        //     'student' => [
        //         'programs.index', 'programs.show',
        //         'applications.my', 'applications.store', 'applications.withdraw',
        //         'challans.my', 'challans.upload-slip', 'challans.pdf',
        //         'challans.my-show', 
        //         // 'payments.verify-slip',
        //         'payments.slip',
        //         // CMS pages (students/public see only published)
        //         'cms.pages.index', 'cms.pages.show',
        //         // student: read-only
        //         'cms.announcements.index', 'cms.announcements.show',
        //         // CMS menus (student: read-only)
        //         'cms.menus.index', 'cms.menus.show',
        //         // CMS banners (student: read-only)
        //         'cms.banners.index', 'cms.banners.show',
        //         // CMS media (student: read-only)
        //         'cms.media.index', 'cms.media.show',
        //     ],
        // ];

        $map = [
            'college_admin' => [
                // Programs & fee structures
                'programs.index', 'programs.store', 'programs.show',
                'programs.update', 'programs.destroy', 'programs.fee-structures',
                'programs.fee-structures', 'programs.fee-structures.update', 'programs.fee-structures.destroy',
                // Applications (admin side)
                'applications.index', 'applications.show', 'applications.review',
                'applications.approve', 'applications.reject', 'applications.return', 'documents.download',
                'students.import.template', 'students.import',
                'students.index', 'students.store', 'students.show', 'students.update',
                // Affiliated colleges
                'affiliated-colleges.index', 'affiliated-colleges.store',
                'affiliated-colleges.update', 'affiliated-colleges.destroy',
                // Challans (admin side)
                'challans.index', 'challans.store', 'challans.show', 'challans.cancel',
                'challans.mark-paid', 'challans.pdf', 'payments.verify-slip', 'payments.slip',
                'challans.items.store', 'challans.items.update', 'challans.items.destroy',
                // CMS
                'settings.index', 'settings.update',
                'cms.pages.index', 'cms.pages.store', 'cms.pages.show',
                'cms.pages.update', 'cms.pages.destroy',
                'cms.announcements.index', 'cms.announcements.store', 'cms.announcements.show',
                'cms.announcements.update', 'cms.announcements.destroy',
                'cms.menus.index', 'cms.menus.store', 'cms.menus.show',
                'cms.menus.update', 'cms.menus.destroy',
                'cms.banners.index', 'cms.banners.store', 'cms.banners.show',
                'cms.banners.update', 'cms.banners.destroy',
                'cms.media.index', 'cms.media.store', 'cms.media.show', 'cms.media.destroy',
                'audit-logs.index',
                // Timetable
                'courses.index', 'courses.store', 'courses.update', 'courses.destroy',
                'timetable.index', 'timetable.save', 'timetable.destroy', 'menu.timetable',
                'applications.shift',
                'timetable.copy',
                // ── MENU (navigation) privileges — REQUIRED or the sidebar is empty ──
                'menu.programs', 'menu.applications', 'menu.challans', 'menu.students', 'menu.affiliated-colleges',
                'menu.cms',
                'menu.cms.pages', 'menu.cms.menus', 'menu.cms.banners',
                'menu.cms.announcements', 'menu.cms.media', 'menu.cms.settings',
                'menu.audit-logs',
            ],
            'student' => [
                'programs.index', 'programs.show',
                'applications.my', 'applications.store', 'applications.withdraw', 'applications.resubmit',
                'profile.show', 'profile.update', 'profile.educations.save', 'profile.educations.destroy', 'profile.documents.upload', 'profile.documents.download', 'profile.documents.destroy',
                'challans.my', 'challans.upload-slip', 'challans.pdf',
                'challans.my-show', 'payments.slip',
                'challans.services', 'challans.request',
                'cms.pages.index', 'cms.pages.show',
                'cms.announcements.index', 'cms.announcements.show',
                'cms.menus.index', 'cms.menus.show',
                'cms.banners.index', 'cms.banners.show',
                'cms.media.index', 'cms.media.show',
                // ── MENU (navigation) privileges for students ──
                'menu.student.profile', 'menu.student.programs', 'menu.student.applications', 'menu.student.challans',
                'timetable.my', 'menu.student.timetable',
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

    // ── 3. Public website (starter pages + header menu) ──────────
    private function seedCmsPages(College $college): void
    {
        app(DefaultCollegeSite::class)->seed($college);
    }

    // ── 4. Settings ───────────────────────────────────────────────
    private function seedSettings(College $college): void
    {
        $settings = [
            ['key' => 'logo',           'value' => null,            'group' => 'branding'],
            ['key' => 'favicon',        'value' => null,            'group' => 'branding'],
            ['key' => 'show_login_link','value' => 'true',          'group' => 'website'],
            ['key' => 'primary_color',  'value' => '#1e40af',       'group' => 'branding'],
            ['key' => 'contact_email',  'value' => $college->email, 'group' => 'contact'],
            ['key' => 'contact_phone',  'value' => $college->phone, 'group' => 'contact'],
            ['key' => 'admission_open', 'value' => 'false',         'group' => 'admission'],
            ['key' => 'allow_multiple_admissions', 'value' => 'false', 'group' => 'admissions'],
            ['key' => 'auto_generate_challan', 'value' => 'true',  'group' => 'fees'],
            ['key' => 'late_fee_mode',         'value' => 'off',   'group' => 'fees'],
            ['key' => 'required_education_levels', 'value' => 'matric,intermediate', 'group' => 'admission'],
            ['key' => 'require_complete_profile', 'value' => 'true', 'group' => 'admission'],
            ['key' => 'post_approval_editable_fields', 'value' => 'phone,email,present_address,emergency_contact', 'group' => 'admission'],
            ['key' => 'late_fee_amount',       'value' => '0',     'group' => 'fees'],
            ['key' => 'late_fee_partial',      'value' => 'from_day_one', 'group' => 'fees'],
            ['key' => 'service_challan_due_days', 'value' => '7',     'group' => 'fees'],
            ['key' => 'timetable_days',        'value' => '1,2,3,4,5',   'group' => 'timetable'],
            ['key' => 'shifts',                'value' => 'morning',     'group' => 'timetable'],
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