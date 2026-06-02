<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class ChallanPrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $superAdminRoleId = DB::table('roles')
            ->where('slug', 'super_admin')->whereNull('college_id')->value('id');

        $collegeAdminRoles = DB::table('roles')
            ->where('slug', 'college_admin')->whereNotNull('college_id')->pluck('id');

        $studentRoles = DB::table('roles')
            ->where('slug', 'student')->whereNotNull('college_id')->pluck('id');

        $groupId = DB::table('privilege_groups')->where('slug', 'fee-management')->value('id');
        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name' => 'Fee Management', 'slug' => 'fee-management',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        $privileges = [
            // Admin
            ['slug' => 'challans.index',       'name' => 'List challans',         'route' => '/api/challans',                        'method' => 'GET',  'for' => 'admin'],
            ['slug' => 'challans.store',        'name' => 'Generate challan',      'route' => '/api/challans',                        'method' => 'POST', 'for' => 'admin'],
            ['slug' => 'challans.show',         'name' => 'View challan',          'route' => '/api/challans/{id}',                   'method' => 'GET',  'for' => 'admin'],
            ['slug' => 'challans.cancel',       'name' => 'Cancel challan',        'route' => '/api/challans/{id}/cancel',            'method' => 'POST', 'for' => 'admin'],
            ['slug' => 'challans.mark-paid',    'name' => 'Mark challan paid',     'route' => '/api/challans/{id}/mark-paid',         'method' => 'POST', 'for' => 'admin'],
            ['slug' => 'challans.pdf',          'name' => 'Download challan PDF',  'route' => '/api/challans/{id}/pdf',               'method' => 'GET',  'for' => 'both'],
            ['slug' => 'payments.verify-slip',  'name' => 'Verify payment slip',   'route' => '/api/payments/{id}/verify-slip',       'method' => 'POST', 'for' => 'admin'],
            ['slug' => 'payments.slip',         'name' => 'Download payment slip', 'route' => '/api/payments/{id}/slip',              'method' => 'GET',  'for' => 'admin'],
            // Student
            ['slug' => 'challans.my',           'name' => 'My challans',           'route' => '/api/challans/my',                     'method' => 'GET',  'for' => 'student'],
            ['slug' => 'challans.upload-slip',  'name' => 'Upload payment slip',   'route' => '/api/challans/{id}/upload-slip',       'method' => 'POST', 'for' => 'student'],
        ];

        $adminPrivIds = []; $studentPrivIds = [];

        foreach ($privileges as $priv) {
            $privId = DB::table('privileges')->where('slug', $priv['slug'])->value('id');
            if (!$privId) {
                $privId = DB::table('privileges')->insertGetId([
                    'privilege_group_id' => $groupId,
                    'name'      => $priv['name'],
                    'slug'      => $priv['slug'],
                    'api_route' => $priv['route'],
                    'method'    => $priv['method'],
                    'is_active' => true,
                    'show_in_menu' => false,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }

            if (in_array($priv['for'], ['admin', 'both']))   $adminPrivIds[]   = $privId;
            if (in_array($priv['for'], ['student', 'both'])) $studentPrivIds[] = $privId;
        }

        // Assign to super admin
        $this->assign($superAdminRoleId, array_merge($adminPrivIds, $studentPrivIds), $now);

        // Assign to college admin roles
        foreach ($collegeAdminRoles as $roleId) {
            $this->assign($roleId, $adminPrivIds, $now);
        }

        // Assign to student roles
        foreach ($studentRoles as $roleId) {
            $this->assign($roleId, $studentPrivIds, $now);
        }

        $this->command->info('ChallanPrivilegeSeeder done.');
    }

    private function assign(?int $roleId, array $privIds, Carbon $now): void
    {
        if (!$roleId) return;
        foreach ($privIds as $privId) {
            if (!DB::table('privilege_role')->where('role_id', $roleId)->where('privilege_id', $privId)->exists()) {
                DB::table('privilege_role')->insert(['role_id' => $roleId, 'privilege_id' => $privId, 'created_at' => $now]);
            }
        }
    }
}