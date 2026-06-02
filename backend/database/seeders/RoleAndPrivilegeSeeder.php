<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class RoleAndPrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        // ── 1. Platform-level Super Admin role (college_id = null) ──
        $superAdminRoleId = DB::table('roles')->where('slug', 'super_admin')->value('id');

        if (!$superAdminRoleId) {
            $superAdminRoleId = DB::table('roles')->insertGetId([
                'name'       => 'Super Admin',
                'slug'       => 'super_admin',
                'college_id' => null,
                'scope'      => 'platform',
                'is_active'  => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // ── 2. Privilege group for college admin management ──────────
        $groupId = DB::table('privilege_groups')->where('slug', 'college-management')->value('id');
        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name'       => 'College Management',
                'slug'       => 'college-management',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // ── 3. Privileges for the new routes ────────────────────────
        $privileges = [
            // CollegeAdminController routes
            [
                'slug'      => 'college-admins.index',
                'name'      => 'List college admins',
                'api_route' => '/api/college-admins',
                'method'    => 'GET',
            ],
            [
                'slug'      => 'college-admins.store',
                'name'      => 'Create college admin',
                'api_route' => '/api/college-admins',
                'method'    => 'POST',
            ],
            [
                'slug'      => 'college-admins.update',
                'name'      => 'Update college admin',
                'api_route' => '/api/college-admins/{id}',
                'method'    => 'PUT',
            ],
        ];

        $privilegeIds = [];
        foreach ($privileges as $priv) {
            $existing = DB::table('privileges')->where('slug', $priv['slug'])->value('id');
            if (!$existing) {
                $existing = DB::table('privileges')->insertGetId([
                    'privilege_group_id' => $groupId,
                    'name'               => $priv['name'],
                    'slug'               => $priv['slug'],
                    'api_route'          => $priv['api_route'],
                    'method'             => $priv['method'],
                    'is_active'          => true,
                    'show_in_menu'       => false,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ]);
            }
            $privilegeIds[] = $existing;
        }

        // ── 4. Assign all privileges to Super Admin role ──────────
        foreach ($privilegeIds as $privId) {
            $exists = DB::table('privilege_role')
                ->where('role_id', $superAdminRoleId)
                ->where('privilege_id', $privId)
                ->exists();

            if (!$exists) {
                DB::table('privilege_role')->insert([
                    'role_id'      => $superAdminRoleId,
                    'privilege_id' => $privId,
                    'created_at'   => $now,
                    // 'updated_at'   => $now,
                ]);
            }
        }

        // ── 5. Make sure the seeded super admin user has this role ──
        $superAdmin = DB::table('users')->where('user_type', 'super_admin')->first();
        if ($superAdmin) {
            $hasRole = DB::table('role_user')
                ->where('user_id', $superAdmin->id)
                ->where('role_id', $superAdminRoleId)
                ->exists();

            if (!$hasRole) {
                DB::table('role_user')->insert([
                    'user_id'    => $superAdmin->id,
                    'role_id'    => $superAdminRoleId,
                    'is_active'  => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            // Set active role if not set
            if (!$superAdmin->active_role_id) {
                DB::table('users')
                    ->where('id', $superAdmin->id)
                    ->update(['active_role_id' => $superAdminRoleId]);
            }
        }

        $this->command->info('RoleAndPrivilegeSeeder done.');
    }
}