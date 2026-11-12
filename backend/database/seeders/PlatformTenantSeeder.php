<?php

namespace Database\Seeders;

use App\Models\College;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;

// The main domain (no subdomain) resolves to this row in ResolveTenant,
// so the existing CMS (pages, menus, banners, settings) works for the platform site.
class PlatformTenantSeeder extends Seeder
{
    public function run(): void
    {
        College::updateOrCreate(
            ['is_platform' => true],
            [
                'name'        => 'College Admissions Platform',
                'slug'        => '_platform',   // underscore: can never be a real subdomain
                'email'       => 'platform@example.invalid',
                'status'      => 'approved',
                'approved_at' => now(),
            ]
        );

        Cache::forget('tenant:__platform__');
    }
}