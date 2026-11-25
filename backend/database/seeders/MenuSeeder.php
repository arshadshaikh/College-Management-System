<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class MenuSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        // Menu rows are privilege rows with show_in_menu = true and NO api_route
        // (pure navigation — CheckPrivilege never guards them).
        // 'roles' lists which role slugs should see each item.
        $menus = [
            // ── Super admin ──────────────────────────────────────
            ['slug'=>'menu.colleges',       'name'=>'Colleges',       'route'=>'/colleges',       'icon'=>'fa-building',  'roles'=>['super_admin']],
            ['slug'=>'menu.college-admins', 'name'=>'College Admins', 'route'=>'/college-admins', 'icon'=>'fa-user-shield','roles'=>['super_admin']],
            ['slug'=>'menu.settings-group', 'name'=>'Settings',       'route'=>null,              'icon'=>'fa-cog',       'roles'=>['super_admin'], 'children'=>[
                ['slug'=>'menu.users',      'name'=>'User Management',      'route'=>'/users',      'icon'=>'fa-users'],
                ['slug'=>'menu.roles',      'name'=>'Role Management',      'route'=>'/roles',      'icon'=>'fa-shield'],
                ['slug'=>'menu.privileges', 'name'=>'Privilege Management', 'route'=>'/privileges', 'icon'=>'fa-key'],
                ['slug'=>'menu.site-settings', 'name'=>'Site Settings',     'route'=>'/settings',   'icon'=>'fa-cog'],
            ]],
            ['slug'=>'menu.doc-types', 'name'=>'Document Types', 'route'=>'/document-types', 'icon'=>'fa-file-alt', 'roles'=>['super_admin']],

            // ── College admin ────────────────────────────────────
            ['slug'=>'menu.programs',     'name'=>'Programs',     'route'=>'/programs',     'icon'=>'fa-graduation-cap', 'roles'=>['college_admin']],
            ['slug'=>'menu.applications', 'name'=>'Applications', 'route'=>'/applications', 'icon'=>'fa-file-alt',       'roles'=>['college_admin']],
            ['slug'=>'menu.challans',     'name'=>'Challans',     'route'=>'/challans',     'icon'=>'fa-receipt',        'roles'=>['college_admin']],
            ['slug'=>'menu.payment-slips', 'name'=>'Payment Slips', 'route'=>'/payment-slips', 'icon'=>'fa-money-check', 'roles'=>['college_admin']],
            ['slug'=>'menu.collections',  'name'=>'Fee Collection', 'route'=>'/collections', 'icon'=>'fa-chart-line',     'roles'=>['college_admin']],
            ['slug'=>'menu.defaulters',   'name'=>'Fee Defaulters', 'route'=>'/defaulters',  'icon'=>'fa-file-invoice',   'roles'=>['college_admin']],
            ['slug'=>'menu.students',     'name'=>'Students',     'route'=>'/students',     'icon'=>'fa-user-graduate',  'roles'=>['college_admin']],
            ['slug'=>'menu.timetable',    'name'=>'Timetable',    'route'=>'/timetable',    'icon'=>'fa-calendar-alt',   'roles'=>['college_admin']],
            ['slug'=>'menu.settings',     'name'=>'Settings',     'route'=>'/settings',     'icon'=>'fa-cog',            'roles'=>['college_admin']],
            ['slug'=>'menu.cms',          'name'=>'CMS',          'route'=>null,            'icon'=>'fa-globe',          'roles'=>['college_admin','super_admin'], 'children'=>[
                ['slug'=>'menu.cms.pages',         'name'=>'Pages',         'route'=>'/cms/pages',         'icon'=>'fa-file'],
                ['slug'=>'menu.cms.menus',         'name'=>'Menus',         'route'=>'/cms/menus',         'icon'=>'fa-bars'],
                ['slug'=>'menu.cms.banners',       'name'=>'Banners',       'route'=>'/cms/banners',       'icon'=>'fa-image'],
                ['slug'=>'menu.cms.announcements', 'name'=>'Announcements', 'route'=>'/cms/announcements', 'icon'=>'fa-bullhorn'],
                ['slug'=>'menu.cms.media',         'name'=>'Media',         'route'=>'/cms/media',         'icon'=>'fa-photo-video'],
            ]],

            // ── Student ──────────────────────────────────────────
            ['slug'=>'menu.student.profile',      'name'=>'My Profile',       'route'=>'/my-profile',       'icon'=>'fa-user',           'roles'=>['student']],
            ['slug'=>'menu.student.programs',     'name'=>'Programs',         'route'=>'/programs',         'icon'=>'fa-graduation-cap', 'roles'=>['student']],
            ['slug'=>'menu.student.applications', 'name'=>'My Applications',  'route'=>'/my-applications',  'icon'=>'fa-file-alt',       'roles'=>['student']],
            ['slug'=>'menu.student.challans',     'name'=>'My Challans',      'route'=>'/my-challans',      'icon'=>'fa-receipt',        'roles'=>['student']],
            ['slug'=>'menu.student.timetable',    'name'=>'My Timetable',     'route'=>'/my-timetable',     'icon'=>'fa-calendar-alt',   'roles'=>['student']],

            // ── Shared ───────────────────────────────────────────
            ['slug'=>'menu.audit-logs', 'name'=>'Audit Logs', 'route'=>'/audit-logs', 'icon'=>'fa-history', 'roles'=>['super_admin','college_admin']],
        ];

        $groupId = $this->menuGroupId($now);
        $sort = 1;

        foreach ($menus as $item) {
            $parentId = $this->upsertMenu($item, $groupId, null, $sort++, 'menu', $now);
            $this->grantToRoles($parentId, $item['roles'], $now);

            $childSort = 1;
            foreach ($item['children'] ?? [] as $child) {
                $childId = $this->upsertMenu($child, $groupId, $parentId, $childSort++, 'submenu', $now);
                $this->grantToRoles($childId, $item['roles'], $now);
            }
        }

        // Settings left CMS (it is not about the website). Remove the old CMS → Site Settings item.
        $this->removeMenu('menu.cms.settings');

        // Super admin gets EVERY privilege — self-healing, so new privileges
        // are picked up automatically on the next run.
        $this->grantAllToSuperAdmin($now);

        $this->command->info('MenuSeeder done.');
    }

    private function menuGroupId(Carbon $now): int
    {
        $id = DB::table('privilege_groups')->where('slug', 'navigation')->value('id');
        return $id ?: DB::table('privilege_groups')->insertGetId([
            'name' => 'Navigation', 'slug' => 'navigation',
            'created_at' => $now, 'updated_at' => $now,
        ]);
    }

    private function upsertMenu(array $item, int $groupId, ?int $parentId, int $sort, string $type, Carbon $now): int
    {
        $id = DB::table('privileges')->where('slug', $item['slug'])->value('id');

        $data = [
            'privilege_group_id' => $groupId,
            'parent_id'          => $parentId,
            'name'               => $item['name'],
            'frontend_route'     => $item['route'],
            'api_route'          => null,      // navigation only
            'method'             => null,
            'menu_type'          => $type,
            'icon'               => $item['icon'],
            'sort_order'         => $sort,
            'show_in_menu'       => true,
            'is_active'          => true,
            'updated_at'         => $now,
        ];

        if ($id) {
            DB::table('privileges')->where('id', $id)->update($data);
            return $id;
        }

        return DB::table('privileges')->insertGetId($data + [
            'slug' => $item['slug'], 'created_at' => $now,
        ]);
    }

    private function grantToRoles(int $privilegeId, array $roleSlugs, Carbon $now): void
    {
        foreach ($roleSlugs as $slug) {
            // One row for super_admin; one per college for tenant roles.
            $roleIds = DB::table('roles')->where('slug', $slug)->pluck('id');

            foreach ($roleIds as $roleId) {
                $exists = DB::table('privilege_role')
                    ->where('role_id', $roleId)->where('privilege_id', $privilegeId)->exists();

                if (!$exists) {
                    DB::table('privilege_role')->insert([
                        'role_id' => $roleId, 'privilege_id' => $privilegeId, 'created_at' => $now,
                    ]);
                }
            }
        }
    }

    // Drop a retired menu item and its role grants. Safe to run again.
    private function removeMenu(string $slug): void
    {
        $id = DB::table('privileges')->where('slug', $slug)->whereNull('api_route')->value('id');
        if (!$id) return;
        DB::table('privilege_role')->where('privilege_id', $id)->delete();
        DB::table('privileges')->where('id', $id)->delete();
    }

    private function grantAllToSuperAdmin(Carbon $now): void
    {
        $roleId = DB::table('roles')->where('slug','super_admin')->whereNull('college_id')->value('id');
        if (!$roleId) return;

        // Only FUNCTIONAL privileges (real api_route). Navigation rows are granted
        // explicitly per role above — never bulk-granted here, or menus leak across roles.
        $privIds = DB::table('privileges')->whereNotNull('api_route')->pluck('id');

        foreach ($privIds as $privId) {
            if (!DB::table('privilege_role')->where('role_id',$roleId)->where('privilege_id',$privId)->exists()) {
                DB::table('privilege_role')->insert(['role_id'=>$roleId,'privilege_id'=>$privId,'created_at'=>$now]);
            }
        }
    }
}