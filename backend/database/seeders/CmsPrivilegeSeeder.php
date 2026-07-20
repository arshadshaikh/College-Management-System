<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class CmsPrivilegeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $groupId = DB::table('privilege_groups')->where('slug', 'cms-management')->value('id');
        if (!$groupId) {
            $groupId = DB::table('privilege_groups')->insertGetId([
                'name' => 'CMS Management', 'slug' => 'cms-management',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        $privileges = [
            ['slug' => 'settings.index',  'name' => 'View settings',   'route' => '/api/settings', 'method' => 'GET'],
            ['slug' => 'settings.update', 'name' => 'Update settings', 'route' => '/api/settings', 'method' => 'PUT'],

            ['slug' => 'cms.pages.index',   'name' => 'List CMS pages',  'route' => '/api/cms/pages',        'method' => 'GET'],
            ['slug' => 'cms.pages.store',   'name' => 'Create CMS page', 'route' => '/api/cms/pages',        'method' => 'POST'],
            ['slug' => 'cms.pages.show',    'name' => 'View CMS page',   'route' => '/api/cms/pages/{id}',   'method' => 'GET'],
            ['slug' => 'cms.pages.update',  'name' => 'Update CMS page', 'route' => '/api/cms/pages/{id}',   'method' => 'PUT'],
            ['slug' => 'cms.pages.destroy', 'name' => 'Delete CMS page', 'route' => '/api/cms/pages/{id}',   'method' => 'DELETE'],

            ['slug' => 'cms.announcements.index',   'name' => 'List announcements',  'route' => '/api/cms/announcements',        'method' => 'GET'],
            ['slug' => 'cms.announcements.store',   'name' => 'Create announcement', 'route' => '/api/cms/announcements',        'method' => 'POST'],
            ['slug' => 'cms.announcements.show',    'name' => 'View announcement',   'route' => '/api/cms/announcements/{id}',   'method' => 'GET'],
            ['slug' => 'cms.announcements.update',  'name' => 'Update announcement', 'route' => '/api/cms/announcements/{id}',   'method' => 'PUT'],
            ['slug' => 'cms.announcements.destroy', 'name' => 'Delete announcement', 'route' => '/api/cms/announcements/{id}',   'method' => 'DELETE'],

            ['slug' => 'cms.menus.index',   'name' => 'List menus',  'route' => '/api/cms/menus',        'method' => 'GET'],
            ['slug' => 'cms.menus.store',   'name' => 'Create menu', 'route' => '/api/cms/menus',        'method' => 'POST'],
            ['slug' => 'cms.menus.show',    'name' => 'View menu',   'route' => '/api/cms/menus/{id}',   'method' => 'GET'],
            ['slug' => 'cms.menus.update',  'name' => 'Update menu', 'route' => '/api/cms/menus/{id}',   'method' => 'PUT'],
            ['slug' => 'cms.menus.destroy', 'name' => 'Delete menu', 'route' => '/api/cms/menus/{id}',   'method' => 'DELETE'],

            ['slug' => 'cms.banners.index',   'name' => 'List banners',  'route' => '/api/cms/banners',        'method' => 'GET'],
            ['slug' => 'cms.banners.store',   'name' => 'Create banner', 'route' => '/api/cms/banners',        'method' => 'POST'],
            ['slug' => 'cms.banners.show',    'name' => 'View banner',   'route' => '/api/cms/banners/{id}',   'method' => 'GET'],
            ['slug' => 'cms.banners.update',  'name' => 'Update banner', 'route' => '/api/cms/banners/{id}',   'method' => 'PUT'],
            ['slug' => 'cms.banners.destroy', 'name' => 'Delete banner', 'route' => '/api/cms/banners/{id}',   'method' => 'DELETE'],

            ['slug' => 'cms.media.index',   'name' => 'List media',  'route' => '/api/cms/media',        'method' => 'GET'],
            ['slug' => 'cms.media.store',   'name' => 'Upload media', 'route' => '/api/cms/media',        'method' => 'POST'],
            ['slug' => 'cms.media.show',    'name' => 'View media',   'route' => '/api/cms/media/{id}',   'method' => 'GET'],
            ['slug' => 'cms.media.destroy', 'name' => 'Delete media', 'route' => '/api/cms/media/{id}',   'method' => 'DELETE'],
        ];

        $superAdminRoleId = DB::table('roles')->where('slug','super_admin')->whereNull('college_id')->value('id');
        $collegeAdminRoles = DB::table('roles')->where('slug','college_admin')->whereNotNull('college_id')->pluck('id');

        foreach ($privileges as $priv) {
            $privId = DB::table('privileges')->where('slug', $priv['slug'])->value('id');
            if (!$privId) {
                $privId = DB::table('privileges')->insertGetId([
                    'privilege_group_id' => $groupId,
                    'name' => $priv['name'], 'slug' => $priv['slug'],
                    'api_route' => $priv['route'], 'method' => $priv['method'],
                    'is_active' => true, 'show_in_menu' => false,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }

            // super admin bypasses CheckPrivilege (Option B), but grant anyway for consistency
            foreach ($collegeAdminRoles as $roleId) {
                if (!DB::table('privilege_role')->where('role_id',$roleId)->where('privilege_id',$privId)->exists()) {
                    DB::table('privilege_role')->insert([
                        'role_id' => $roleId, 'privilege_id' => $privId, 'created_at' => $now,
                    ]);
                }
            }
        }

        $this->command->info('CmsPrivilegeSeeder done.');
    }
}