<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Class timetable: courses, timetable editor (college admin) and the student's own timetable.
 * Idempotent. New colleges get the same slugs via CollegeInitializationService::seedRolePrivileges $map.
 */
class TimetablePrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $superAdminRoleId = DB::table('roles')->where('slug', 'super_admin')->whereNull('college_id')->value('id');
        $adminRoles       = DB::table('roles')->where('slug', 'college_admin')->whereNotNull('college_id')->pluck('id');
        $studentRoles     = DB::table('roles')->where('slug', 'student')->whereNotNull('college_id')->pluck('id');

        $groupId = DB::table('privilege_groups')->where('slug', 'timetable')->value('id');
        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name' => 'Timetable', 'slug' => 'timetable',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // College admin
        $adminPrivileges = [
            ['slug' => 'courses.index',   'name' => 'List program courses',  'route' => '/api/programs/{id}/courses', 'method' => 'GET'],
            ['slug' => 'courses.store',   'name' => 'Add program course',    'route' => '/api/programs/{id}/courses', 'method' => 'POST'],
            ['slug' => 'courses.update',  'name' => 'Update course',         'route' => '/api/courses/{id}',          'method' => 'PUT'],
            ['slug' => 'courses.destroy', 'name' => 'Delete course',         'route' => '/api/courses/{id}',          'method' => 'DELETE'],
            ['slug' => 'timetable.index',   'name' => 'View timetables',        'route' => '/api/timetable',      'method' => 'GET'],
            ['slug' => 'timetable.save',    'name' => 'Save timetable class',   'route' => '/api/timetable',      'method' => 'POST'],
            ['slug' => 'timetable.destroy', 'name' => 'Remove timetable class', 'route' => '/api/timetable/{id}', 'method' => 'DELETE'],
            ['slug' => 'timetable.copy',    'name' => 'Copy timetable from another term', 'route' => '/api/timetable/copy', 'method' => 'POST'],
            ['slug' => 'applications.shift', 'name' => 'Change application shift', 'route' => '/api/applications/{id}/shift', 'method' => 'PUT'],
        ];

        $adminIds = $this->ensurePrivileges($adminPrivileges, $groupId, $now);

        $this->assignPrivileges($superAdminRoleId, $adminIds, $now);
        foreach ($adminRoles as $roleId) {
            $this->assignPrivileges($roleId, $adminIds, $now);
        }

        // Student: own timetable
        $studentIds = $this->ensurePrivileges([
            ['slug' => 'timetable.my', 'name' => 'View my timetable', 'route' => '/api/timetable/my', 'method' => 'GET'],
        ], $groupId, $now);

        $this->assignPrivileges($superAdminRoleId, $studentIds, $now);
        foreach ($studentRoles as $roleId) {
            $this->assignPrivileges($roleId, $studentIds, $now);
        }

        $this->command->info('TimetablePrivilegeSeeder done. ' . count($adminIds) . ' admin privilege(s), ' . $adminRoles->count() . ' college admin role(s), ' . $studentRoles->count() . ' student role(s).');
    }

    private function ensurePrivileges(array $privileges, int $groupId, Carbon $now): array
    {
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
        return $ids;
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
