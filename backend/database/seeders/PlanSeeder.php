<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Subscription plans. Idempotent.
 *  - Privileges: plans.*, addons.* and colleges.plan (super admin), plan.my (college admins).
 *  - Example plans and add-ons if none exist. Prices are examples; the Super Admin
 *    changes them on the Plans page.
 *  - Colleges without a plan go on the top plan (every feature, no limit), so nothing an
 *    existing college uses today is switched off when plan limits start to apply.
 */
class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $groupId = DB::table('privilege_groups')->where('slug', 'subscriptions')->value('id')
            ?: DB::table('privilege_groups')->insertGetId(['name' => 'Subscriptions', 'slug' => 'subscriptions', 'created_at' => $now, 'updated_at' => $now]);

        $admin = $this->ensure($groupId, $now, [
            ['slug' => 'plans.index',   'name' => 'List plans',             'route' => '/api/plans',             'method' => 'GET'],
            ['slug' => 'plans.store',   'name' => 'Create plan',            'route' => '/api/plans',             'method' => 'POST'],
            ['slug' => 'plans.show',    'name' => 'View plan',              'route' => '/api/plans/{id}',        'method' => 'GET'],
            ['slug' => 'plans.update',  'name' => 'Update plan',            'route' => '/api/plans/{id}',        'method' => 'PUT'],
            ['slug' => 'plans.destroy', 'name' => 'Delete plan',            'route' => '/api/plans/{id}',        'method' => 'DELETE'],
            ['slug' => 'addons.store',   'name' => 'Create add-on',          'route' => '/api/addons',            'method' => 'POST'],
            ['slug' => 'addons.update',  'name' => 'Update add-on',          'route' => '/api/addons/{id}',       'method' => 'PUT'],
            ['slug' => 'addons.destroy', 'name' => 'Delete add-on',          'route' => '/api/addons/{id}',       'method' => 'DELETE'],
            ['slug' => 'colleges.plan', 'name' => 'Change a college\'s plan', 'route' => '/api/colleges/{id}/plan', 'method' => 'PUT'],
        ]);
        $mine = $this->ensure($groupId, $now, [
            ['slug' => 'plan.my', 'name' => 'View own plan and usage', 'route' => '/api/my-plan', 'method' => 'GET'],
        ]);

        $superAdminRoleId  = DB::table('roles')->where('slug', 'super_admin')->whereNull('college_id')->value('id');
        $collegeAdminRoles = DB::table('roles')->where('slug', 'college_admin')->whereNotNull('college_id')->pluck('id');
        $this->assign($superAdminRoleId, $admin, $now);
        foreach ($collegeAdminRoles as $roleId) $this->assign($roleId, $mine, $now);

        // Example plans, only on a fresh install of this feature.
        if (!DB::table('plans')->exists()) {
            $starter = ['online_slips', 'fee_statement'];
            $growth  = array_merge($starter, ['reports', 'bulk_challans', 'installments', 'student_import']);
            $pro     = array_merge($growth, ['service_challans', 'timetable']);
            $plans = [
                ['Starter',    200,  20000, false, 1, 'For a small college: admissions, students, challans and online payment slips.', $starter],
                ['Growth',     500,  35000, true,  2, 'Everything in Starter plus fee reports, class billing, installments and Excel import.', $growth],
                ['Pro',        1500, 60000, false, 3, 'Everything in Growth plus service requests and class timetables.', $pro],
                ['Enterprise', null, 0,     false, 4, 'Every feature and no student limit. Price agreed per college.', array_keys(config('plans.features'))],
            ];
            foreach ($plans as [$name, $max, $price, $default, $sort, $desc, $features]) {
                DB::table('plans')->insert([
                    'name' => $name, 'slug' => strtolower($name), 'description' => $desc,
                    'price' => $price, 'billing_period' => 'monthly', 'max_students' => $max,
                    'features' => json_encode(array_values($features)), 'is_default' => $default, 'is_active' => true,
                    'sort_order' => $sort, 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // Example add-ons, only on a fresh install of add-ons.
        if (!DB::table('addons')->exists()) {
            $addons = [
                ['College website (CMS)', 'feature',  'website',       null, 5000, 1, 'Public website pages, menus, banners and announcements.'],
                ['Fee reminders',         'feature',  'fee_reminders', null, 3000, 2, 'SMS / email reminders before and after a challan is due.'],
                ['Class timetable',       'feature',  'timetable',     null, 3000, 3, 'Timetables without moving up to the next plan.'],
                ['Extra 100 students',    'students', null,            100,  4000, 4, 'Raises the student limit by 100 for each unit.'],
            ];
            foreach ($addons as [$name, $kind, $feature, $per, $price, $sort, $desc]) {
                DB::table('addons')->insert([
                    'name' => $name, 'description' => $desc, 'kind' => $kind, 'feature' => $feature, 'students_per_unit' => $per,
                    'price' => $price, 'is_active' => true, 'sort_order' => $sort, 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // The plan with every feature and no limit (Enterprise, or Premium from an earlier install).
        $top = DB::table('plans')->whereNull('max_students')->orderByDesc('sort_order')->value('id')
            ?? DB::table('plans')->orderByDesc('sort_order')->value('id');
        $moved = DB::table('colleges')->where('is_platform', false)->whereNull('plan_id')->whereNull('deleted_at')
            ->update(['plan_id' => $top, 'updated_at' => $now]);

        $this->command->info("PlanSeeder done. Plans: " . DB::table('plans')->count() . ", add-ons: " . DB::table('addons')->count() . ", colleges put on a plan: {$moved}.");
    }

    private function ensure(int $groupId, Carbon $now, array $privileges): array
    {
        $ids = [];
        foreach ($privileges as $priv) {
            $id = DB::table('privileges')->where('slug', $priv['slug'])->value('id');
            if (!$id) {
                $id = DB::table('privileges')->insertGetId([
                    'privilege_group_id' => $groupId, 'name' => $priv['name'], 'slug' => $priv['slug'],
                    'api_route' => $priv['route'], 'method' => $priv['method'],
                    'is_active' => true, 'show_in_menu' => false, 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
            $ids[] = $id;
        }
        return $ids;
    }

    private function assign(?int $roleId, array $privilegeIds, Carbon $now): void
    {
        if (!$roleId) return;
        foreach ($privilegeIds as $privId) {
            if (!DB::table('privilege_role')->where('role_id', $roleId)->where('privilege_id', $privId)->exists()) {
                DB::table('privilege_role')->insert(['role_id' => $roleId, 'privilege_id' => $privId, 'created_at' => $now]);
            }
        }
    }
}
