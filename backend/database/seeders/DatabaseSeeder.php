<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // $this->call(AdminSeeder::class);
        // $this->call(CollegeSeeder::class);

        $this->call([
            SuperAdminSeeder::class,        // super_admin role + user first
            RoleAndPrivilegeSeeder::class,  // college-admin mgmt privileges + grants
            CollegeSeeder::class,           // seeds Example College (id 1)
            CollegePrivilegeSeeder::class,  // college approve/reject/suspend privileges
            ProgramPrivilegeSeeder::class,  // programs + applications privileges
            ChallanPrivilegeSeeder::class,  // fee/challan privileges
            CmsPrivilegeSeeder::class,      // CMS privileges
        ]);
    }
}
