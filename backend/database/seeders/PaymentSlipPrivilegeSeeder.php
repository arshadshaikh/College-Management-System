<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Payment slip queue: college admins review every uploaded slip in one place. Idempotent.
 */
class PaymentSlipPrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $superAdminRoleId  = DB::table('roles')->where('slug', 'super_admin')->whereNull('college_id')->value('id');
        $collegeAdminRoles = DB::table('roles')->where('slug', 'college_admin')->whereNotNull('college_id')->pluck('id');

        $groupId = DB::table('privilege_groups')->where('slug', 'fee-management')->value('id');
        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name' => 'Fee Management', 'slug' => 'fee-management',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        $privileges = [
            ['slug' => 'payments.slips', 'name' => 'Payment slip queue', 'route' => '/api/payments/slips', 'method' => 'GET'],
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
        foreach ($collegeAdminRoles as $roleId) {
            $this->assignPrivileges($roleId, $ids, $now);
        }

        $this->command->info('PaymentSlipPrivilegeSeeder done. ' . count($ids) . ' privilege(s), ' . $collegeAdminRoles->count() . ' college admin role(s).');
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
