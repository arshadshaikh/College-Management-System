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
            AdminCrudPrivilegeSeeder::class, // users/roles/privileges admin screens (slugs match App.jsx guards)
            DocumentTypePrivilegeSeeder::class, // required document types admin screens
            CollegeSeeder::class,           // seeds Example College (id 1)
            PlatformTenantSeeder::class,    // main-domain tenant for the platform site (is_platform)
            PlatformPageSeeder::class,      // starter pages + header menu for the platform site
            CollegePrivilegeSeeder::class,  // college approve/reject/suspend privileges
            ProgramPrivilegeSeeder::class,  // programs + applications privileges
            ProfilePrivilegeSeeder::class,  // applicant profile (student side)
            ChallanPrivilegeSeeder::class,  // fee/challan privileges
            CmsPrivilegeSeeder::class,      // CMS privileges
            MenuSeeder::class,              // menu items for super_admin + college_admin + student
            SettingsBackfillSeeder::class,  // ensure every college has all expected settings
            CollegeSiteBackfillSeeder::class, // default public pages + header menu for existing colleges
            StudentDocumentTypeSeeder::class, // applicant-profile document types (scope student_application)
        ]);
    }
}
