<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Student fee statement. Admins see any student's (students.statement*), a student
 * sees only their own (statement.my*; the controller uses the logged-in user).
 * Idempotent.
 */
class StatementPrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $groupId = DB::table('privilege_groups')->where('slug', 'fee-management')->value('id');
        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name' => 'Fee Management', 'slug' => 'fee-management',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        $admin = $this->ensure($groupId, $now, [
            ['slug' => 'students.statement',     'name' => 'Student fee statement',     'route' => '/api/students/{id}/statement',     'method' => 'GET'],
            ['slug' => 'students.statement-pdf', 'name' => 'Student fee statement PDF', 'route' => '/api/students/{id}/statement/pdf', 'method' => 'GET'],
        ]);
        $student = $this->ensure($groupId, $now, [
            ['slug' => 'statement.my',     'name' => 'My fee statement',     'route' => '/api/my-statement',     'method' => 'GET'],
            ['slug' => 'statement.my-pdf', 'name' => 'My fee statement PDF', 'route' => '/api/my-statement/pdf', 'method' => 'GET'],
        ]);

        $superAdminRoleId  = DB::table('roles')->where('slug', 'super_admin')->whereNull('college_id')->value('id');
        $collegeAdminRoles = DB::table('roles')->where('slug', 'college_admin')->whereNotNull('college_id')->pluck('id');
        $studentRoles      = DB::table('roles')->where('slug', 'student')->whereNotNull('college_id')->pluck('id');

        $this->assign($superAdminRoleId, $admin, $now);
        foreach ($collegeAdminRoles as $roleId) $this->assign($roleId, $admin, $now);
        foreach ($studentRoles as $roleId) $this->assign($roleId, $student, $now);

        $this->command->info('StatementPrivilegeSeeder done. ' . $collegeAdminRoles->count() . ' college admin role(s), ' . $studentRoles->count() . ' student role(s).');
    }

    private function ensure(int $groupId, Carbon $now, array $privileges): array
    {
        $ids = [];
        foreach ($privileges as $priv) {
            $id = DB::table('privileges')->where('slug', $priv['slug'])->value('id');
            if (!$id) {
                $id = DB::table('privileges')->insertGetId([
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
            $ids[] = $id;
        }
        return $ids;
    }

    private function assign(?int $roleId, array $privilegeIds, Carbon $now): void
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
