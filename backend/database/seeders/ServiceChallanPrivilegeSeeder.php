<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Students request service challans (Transcript, Duplicate ID Card ...) themselves.
 * A service = a fee type with an amount in Settings -> Fees & Challans. Idempotent.
 */
class ServiceChallanPrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $superAdminRoleId = DB::table('roles')->where('slug', 'super_admin')->whereNull('college_id')->value('id');
        $studentRoles     = DB::table('roles')->where('slug', 'student')->whereNotNull('college_id')->pluck('id');

        $groupId = DB::table('privilege_groups')->where('slug', 'fee-management')->value('id');
        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name' => 'Fee Management', 'slug' => 'fee-management',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        $privileges = [
            ['slug' => 'challans.services', 'name' => 'List services students can request', 'route' => '/api/challans/services', 'method' => 'GET'],
            ['slug' => 'challans.request',  'name' => 'Request a service challan',          'route' => '/api/challans/request',  'method' => 'POST'],
            // Student opens one of their own challans. Was in the college setup map but never seeded.
            ['slug' => 'challans.my-show',  'name' => 'View my challan',                    'route' => '/api/my-challans/{id}',  'method' => 'GET'],
        ];

        $ids = [];
        foreach ($privileges as $priv) {
            $privId = DB::table('privileges')->where('slug', $priv['slug'])->value('id');
            if (!$privId) {
                $privId = DB::table('privileges')->insertGetId([
                    'privilege_group_id' => $groupId,
                    'name'               => $priv['name'],
                    'slug'               => $priv['slug'],
                    'api_route'          => $priv['route'],
                    'method'             => $priv['method'],
                    'is_active'          => true,
                    'show_in_menu'       => false,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ]);
            }
            $ids[] = $privId;
        }

        $this->assignPrivileges($superAdminRoleId, $ids, $now);
        foreach ($studentRoles as $roleId) {
            $this->assignPrivileges($roleId, $ids, $now);
        }

        $this->command->info('ServiceChallanPrivilegeSeeder done. ' . count($ids) . ' privilege(s), ' . $studentRoles->count() . ' student role(s).');
    }

    private function assignPrivileges(?int $roleId, array $privilegeIds, Carbon $now): void
    {
        if (!$roleId) return;
        foreach ($privilegeIds as $privId) {
            $exists = DB::table('privilege_role')->where('role_id', $roleId)->where('privilege_id', $privId)->exists();
            if (!$exists) {
                // privilege_role has no updated_at
                DB::table('privilege_role')->insert(['role_id' => $roleId, 'privilege_id' => $privId, 'created_at' => $now]);
            }
        }
    }
}
