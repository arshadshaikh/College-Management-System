<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class DocumentTypePrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $groupId = DB::table('privilege_groups')->where('slug', 'platform-admin')->value('id')
            ?: DB::table('privilege_groups')->insertGetId([
                'name' => 'Platform Admin', 'slug' => 'platform-admin',
                'created_at' => $now, 'updated_at' => $now,
            ]);

        // Slugs MUST match the PrivilegeRoute / hasPrv guards in the frontend.
        $privileges = [
            ['doc-types.index',   'List Document Types',   '/api/required-document-types',        'GET'],
            ['doc-types.store',   'Create Document Type',  '/api/required-document-types',        'POST'],
            ['doc-types.update',  'Update Document Type',  '/api/required-document-types/{id}',   'PUT'],
            ['doc-types.destroy', 'Delete Document Type',  '/api/required-document-types/{id}',   'DELETE'],
        ];

        $superAdminRoleId = DB::table('roles')->where('slug', 'super_admin')->whereNull('college_id')->value('id');

        foreach ($privileges as [$slug, $name, $route, $method]) {
            $privId = DB::table('privileges')->where('slug', $slug)->value('id');

            if (!$privId) {
                $privId = DB::table('privileges')->insertGetId([
                    'privilege_group_id' => $groupId,
                    'name' => $name, 'slug' => $slug,
                    'api_route' => $route, 'method' => $method,
                    'menu_type' => 'none', 'show_in_menu' => false, 'is_active' => true,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }

            if ($superAdminRoleId) {
                $exists = DB::table('privilege_role')
                    ->where('role_id', $superAdminRoleId)->where('privilege_id', $privId)->exists();
                if (!$exists) {
                    // privilege_role has no updated_at
                    DB::table('privilege_role')->insert([
                        'role_id' => $superAdminRoleId, 'privilege_id' => $privId, 'created_at' => $now,
                    ]);
                }
            }
        }

        $this->command->info('DocumentTypePrivilegeSeeder done.');
    }
}