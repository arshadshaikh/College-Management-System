<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class AdminCrudPrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $groupId = DB::table('privilege_groups')->where('slug','platform-admin')->value('id')
            ?: DB::table('privilege_groups')->insertGetId([
                'name'=>'Platform Admin','slug'=>'platform-admin',
                'created_at'=>$now,'updated_at'=>$now,
            ]);

        // Slugs MUST match the PrivilegeRoute guards in App.jsx
        $privileges = [
            ['user-list',              'User List',              '/api/users',                        'GET'],
            ['create-user',            'Create User',            '/api/users',                        'POST'],
            ['view-user',              'View User',              '/api/users/{id}',                   'GET'],
            ['update-user',            'Update User',            '/api/users/{id}',                   'PUT'],
            ['assign-roles',           'Assign Roles',           '/api/users/{id}/assign-roles',      'POST'],

            ['role-list',              'Role List',              '/api/roles',                        'GET'],
            ['create-role',            'Create Role',            '/api/roles',                        'POST'],
            ['view-role',              'View Role',              '/api/roles/{id}',                   'GET'],
            ['update-role',            'Update Role',            '/api/roles/{id}',                   'PUT'],
            ['assign-privileges',      'Assign Privileges',      '/api/roles/{id}/assign-privileges', 'POST'],

            ['privilege-list',         'Privilege List',         '/api/privileges',                   'GET'],
            ['create-privilege',       'Create Privilege',       '/api/privileges',                   'POST'],
            ['view-privilege',         'View Privilege',         '/api/privileges/{id}',              'GET'],
            ['update-privilege',       'Update Privilege',       '/api/privileges/{id}',              'PUT'],

            ['privilege-group-list',   'Privilege Group List',   '/api/privilege-groups',             'GET'],
            ['create-privilege-group', 'Create Privilege Group', '/api/privilege-groups',             'POST'],
            ['view-privilege-group',   'View Privilege Group',   '/api/privilege-groups/{id}',        'GET'],
            ['update-privilege-group', 'Update Privilege Group', '/api/privilege-groups/{id}',        'PUT'],
        ];

        $superAdminRoleId = DB::table('roles')->where('slug','super_admin')->whereNull('college_id')->value('id');

        foreach ($privileges as [$slug, $name, $route, $method]) {
            $privId = DB::table('privileges')->where('slug',$slug)->value('id');

            if (!$privId) {
                $privId = DB::table('privileges')->insertGetId([
                    'privilege_group_id'=>$groupId,
                    'name'=>$name, 'slug'=>$slug,
                    'api_route'=>$route, 'method'=>$method,
                    'menu_type'=>'none', 'show_in_menu'=>false, 'is_active'=>true,
                    'created_at'=>$now, 'updated_at'=>$now,
                ]);
            }

            if ($superAdminRoleId) {
                $exists = DB::table('privilege_role')
                    ->where('role_id',$superAdminRoleId)->where('privilege_id',$privId)->exists();
                if (!$exists) {
                    DB::table('privilege_role')->insert([
                        'role_id'=>$superAdminRoleId,'privilege_id'=>$privId,'created_at'=>$now,
                    ]);
                }
            }
        }

        $this->command->info('AdminCrudPrivilegeSeeder done.');
    }
}