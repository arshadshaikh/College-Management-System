<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

/**
 * Applicant profile (student side). Idempotent.
 * New colleges get these via CollegeInitializationService::seedRolePrivileges $map.
 */
class ProfilePrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $superAdminRoleId = DB::table('roles')->where('slug', 'super_admin')->whereNull('college_id')->value('id');
        $studentRoles     = DB::table('roles')->where('slug', 'student')->whereNotNull('college_id')->pluck('id');

        $groupId = DB::table('privilege_groups')->where('slug', 'applicant-profile')->value('id');
        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name' => 'Applicant Profile', 'slug' => 'applicant-profile',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        $privileges = [
            ['slug' => 'profile.show',               'name' => 'View my profile',               'route' => '/api/profile',                          'method' => 'GET'],
            ['slug' => 'profile.update',             'name' => 'Update my profile',             'route' => '/api/profile',                          'method' => 'PUT'],
            ['slug' => 'profile.educations.save',    'name' => 'Save education record',         'route' => '/api/profile/educations',               'method' => 'PUT'],
            ['slug' => 'profile.educations.destroy', 'name' => 'Delete education record',       'route' => '/api/profile/educations/{id}',          'method' => 'DELETE'],
            ['slug' => 'profile.documents.upload',   'name' => 'Upload profile document',       'route' => '/api/profile/documents',                'method' => 'POST'],
            ['slug' => 'profile.documents.destroy',  'name' => 'Remove profile document',       'route' => '/api/profile/documents/{id}',           'method' => 'DELETE'],
            ['slug' => 'profile.documents.download', 'name' => 'Download own profile document', 'route' => '/api/profile/documents/{id}/download',  'method' => 'GET'],
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

        $this->command->info('ProfilePrivilegeSeeder done. ' . count($ids) . ' privileges, ' . $studentRoles->count() . ' student role(s).');
    }

    private function assignPrivileges(?int $roleId, array $privilegeIds, Carbon $now): void
    {
        if (!$roleId) return;
        foreach ($privilegeIds as $privId) {
            $exists = DB::table('privilege_role')->where('role_id', $roleId)->where('privilege_id', $privId)->exists();
            if (!$exists) {
                DB::table('privilege_role')->insert(['role_id' => $roleId, 'privilege_id' => $privId, 'created_at' => $now]);
            }
        }
    }
}