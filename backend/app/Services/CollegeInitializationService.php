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

    // ── 2. CMS pages ─────────────────────────────────────────────
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

    // ── 3. Settings ───────────────────────────────────────────────
    private function seedSettings(College $college): void
    {
        $settings = [
            ['key' => 'logo',           'value' => null,            'group' => 'branding'],
            ['key' => 'primary_color',  'value' => '#1e40af',       'group' => 'branding'],
            ['key' => 'contact_email',  'value' => $college->email, 'group' => 'contact'],
            ['key' => 'contact_phone',  'value' => $college->phone, 'group' => 'contact'],
            ['key' => 'admission_open', 'value' => 'false',         'group' => 'admission'],
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