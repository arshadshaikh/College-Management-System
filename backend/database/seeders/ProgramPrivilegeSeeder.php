<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class ProgramPrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        // Super admin role (platform level)
        $superAdminRoleId = DB::table('roles')
            ->where('slug', 'super_admin')
            ->whereNull('college_id')
            ->value('id');

        // Get all college_admin roles (one per college)
        $collegeAdminRoles = DB::table('roles')
            ->where('slug', 'college_admin')
            ->whereNotNull('college_id')
            ->pluck('id');

        // Privilege group
        $groupId = DB::table('privilege_groups')
            ->where('slug', 'academic-management')
            ->value('id');

        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name'       => 'Academic Management',
                'slug'       => 'academic-management',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $privileges = [
            // Programs
            ['slug' => 'programs.index',              'name' => 'List programs',            'route' => '/api/programs',                           'method' => 'GET'],
            ['slug' => 'programs.store',              'name' => 'Create program',           'route' => '/api/programs',                           'method' => 'POST'],
            ['slug' => 'programs.show',               'name' => 'View program',             'route' => '/api/programs/{id}',                      'method' => 'GET'],
            ['slug' => 'programs.update',             'name' => 'Update program',           'route' => '/api/programs/{id}',                      'method' => 'PUT'],
            ['slug' => 'programs.destroy',            'name' => 'Delete program',           'route' => '/api/programs/{id}',                      'method' => 'DELETE'],
            ['slug' => 'programs.fee-structures',     'name' => 'Add fee structure',        'route' => '/api/programs/{id}/fee-structures',       'method' => 'POST'],

            // Applications — admin side
            ['slug' => 'applications.index',          'name' => 'List applications',        'route' => '/api/applications',                       'method' => 'GET'],
            ['slug' => 'applications.show',           'name' => 'View application',         'route' => '/api/applications/{id}',                  'method' => 'GET'],
            ['slug' => 'applications.review',         'name' => 'Mark application review',  'route' => '/api/applications/{id}/review',           'method' => 'POST'],
            ['slug' => 'applications.approve',        'name' => 'Approve application',      'route' => '/api/applications/{id}/approve',          'method' => 'POST'],
            ['slug' => 'applications.reject',         'name' => 'Reject application',       'route' => '/api/applications/{id}/reject',           'method' => 'POST'],
            ['slug' => 'documents.download',          'name' => 'Download document',        'route' => '/api/documents/{id}/download',            'method' => 'GET'],

            // Applications — student side
            ['slug' => 'applications.my',             'name' => 'My applications',          'route' => '/api/applications/my',                    'method' => 'GET'],
            ['slug' => 'applications.store',          'name' => 'Submit application',       'route' => '/api/applications',                       'method' => 'POST'],
            ['slug' => 'applications.withdraw',       'name' => 'Withdraw application',     'route' => '/api/applications/{id}/withdraw',         'method' => 'POST'],
        ];

        $allPrivilegeIds       = [];
        $adminPrivilegeIds     = [];
        $studentPrivilegeIds   = [];

        $adminSlugs  = ['programs.index','programs.store','programs.show','programs.update','programs.destroy','programs.fee-structures','applications.index','applications.show','applications.review','applications.approve','applications.reject','documents.download'];
        $studentSlugs = ['programs.index','programs.show','applications.my','applications.store','applications.withdraw'];

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

            $allPrivilegeIds[$priv['slug']] = $privId;

            if (in_array($priv['slug'], $adminSlugs))   $adminPrivilegeIds[]   = $privId;
            if (in_array($priv['slug'], $studentSlugs)) $studentPrivilegeIds[] = $privId;
        }

        // Assign all privileges to super admin
        $this->assignPrivileges($superAdminRoleId, array_values($allPrivilegeIds), $now);

        // Assign admin privileges to all existing college_admin roles
        foreach ($collegeAdminRoles as $roleId) {
            $this->assignPrivileges($roleId, $adminPrivilegeIds, $now);
        }

        // Assign student privileges to all existing student roles
        $studentRoles = DB::table('roles')
            ->where('slug', 'student')
            ->whereNotNull('college_id')
            ->pluck('id');

        foreach ($studentRoles as $roleId) {
            $this->assignPrivileges($roleId, $studentPrivilegeIds, $now);
        }

        $this->command->info('ProgramPrivilegeSeeder done.');
    }

    private function assignPrivileges(?int $roleId, array $privilegeIds, Carbon $now): void
    {
        if (!$roleId) return;

        foreach ($privilegeIds as $privId) {
            $exists = DB::table('privilege_role')
                ->where('role_id', $roleId)
                ->where('privilege_id', $privId)
                ->exists();

            if (!$exists) {
                DB::table('privilege_role')->insert([
                    'role_id'      => $roleId,
                    'privilege_id' => $privId,
                    'created_at'   => $now,
                ]);
            }
        }
    }
}