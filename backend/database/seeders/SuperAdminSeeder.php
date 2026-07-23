<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        // Canonical platform super admin role (underscore slug, platform scope).
        $role = Role::firstOrCreate(
            ['slug' => 'super_admin', 'college_id' => null],
            ['name' => 'Super Admin', 'scope' => 'platform', 'is_active' => true]
        );

        // The one platform super admin user. Idempotent on cnic_no.
        $admin = User::firstOrCreate(
            ['cnic_no' => '0000000000000'],
            [
                'name'           => 'Super Admin',
                'password'       => 'Admin1234', // hashed by model cast; change after first login
                'is_active'      => true,
                'college_id'     => null,
                'user_type'      => 'super_admin',
                'active_role_id' => $role->id,
            ]
        );

        // Ensure the role is attached (role_user pivot) and active.
        $admin->roles()->syncWithoutDetaching([$role->id => ['is_active' => true]]);

        // Ensure active_role_id points at the super admin role.
        if ($admin->active_role_id !== $role->id) {
            $admin->update(['active_role_id' => $role->id]);
        }

        // ── Platform-level policy settings (college_id = NULL) ──────
        // 'college_choice' delegates the decision to each college's own
        // 'allow_multiple_admissions' setting. Set 'deny' or 'allow' here
        // to enforce platform-wide instead.
        DB::table('settings')->updateOrInsert(
            ['college_id' => null, 'key' => 'multiple_admissions_policy'],
            ['value' => 'college_choice', 'group' => 'admissions', 'updated_at' => now(), 'created_at' => now()]
        );

        $this->command->info('SuperAdminSeeder done.');
    }
}