<?php
// database/seeders/CollegePrivilegeSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class CollegePrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $superAdminRoleId = DB::table('roles')
            ->where('slug', 'super_admin')
            ->whereNull('college_id')
            ->value('id');

        if (!$superAdminRoleId) {
            $this->command->error('Super admin role not found. Run RoleAndPrivilegeSeeder first.');
            return;
        }

        // Privilege group
        $groupId = DB::table('privilege_groups')
            ->where('slug', 'college-management')
            ->value('id');

        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name'       => 'College Management',
                'slug'       => 'college-management',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $privileges = [
            ['slug' => 'colleges.index',   'name' => 'List colleges',    'route' => '/api/colleges',                    'method' => 'GET'],
            ['slug' => 'colleges.show',    'name' => 'View college',     'route' => '/api/colleges/{id}',               'method' => 'GET'],
            ['slug' => 'colleges.update',  'name' => 'Update college',   'route' => '/api/colleges/{id}',               'method' => 'PUT'],
            ['slug' => 'colleges.approve', 'name' => 'Approve college',  'route' => '/api/colleges/{id}/approve',       'method' => 'POST'],
            ['slug' => 'colleges.reject',  'name' => 'Reject college',   'route' => '/api/colleges/{id}/reject',        'method' => 'POST'],
            ['slug' => 'colleges.suspend', 'name' => 'Suspend college',  'route' => '/api/colleges/{id}/suspend',       'method' => 'POST'],
        ];

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

            $exists = DB::table('privilege_role')
                ->where('role_id', $superAdminRoleId)
                ->where('privilege_id', $privId)
                ->exists();

            if (!$exists) {
                DB::table('privilege_role')->insert([
                    'role_id'      => $superAdminRoleId,
                    'privilege_id' => $privId,
                    'created_at'   => $now,
                ]);
            }
        }

        $this->command->info('CollegePrivilegeSeeder done.');
    }
}