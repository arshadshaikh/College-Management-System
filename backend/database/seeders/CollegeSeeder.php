<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class CollegeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    // public function run(): void
    // {
    //     // $collegeId = DB::table('colleges')->insertGetId([
    //     //     'name'        => 'Example College',
    //     //     'slug'        => 'uos',
    //     //     'email'       => 'admin@uos.edu.pk',
    //     //     'phone'       => '0300-0000000',
    //     //     'city'        => 'Karachi',
    //     //     'province'    => 'Sindh',
    //     //     'status'      => 'approved',
    //     //     'approved_at' => Carbon::now(),
    //     //     'created_at'  => Carbon::now(),
    //     //     'updated_at'  => Carbon::now(),
    //     // ]);

    //     // // Default CMS pages for this college
    //     // $pages = ['Home', 'About', 'Admissions', 'Contact'];
    //     // foreach ($pages as $i => $page) {
    //     //     DB::table('cms_pages')->insert([
    //     //         'college_id'   => $collegeId,
    //     //         'title'        => $page,
    //     //         'slug'         => strtolower($page),
    //     //         'content'      => "<h1>$page</h1><p>Content coming soon.</p>",
    //     //         'is_published' => true,
    //     //         'sort_order'   => $i,
    //     //         'created_at'   => Carbon::now(),
    //     //         'updated_at'   => Carbon::now(),
    //     //     ]);
    //     // }

    //     // // Default settings
    //     // $settings = [
    //     //     ['key' => 'logo',          'value' => null,              'group' => 'branding'],
    //     //     ['key' => 'primary_color', 'value' => '#1e40af',         'group' => 'branding'],
    //     //     ['key' => 'contact_email', 'value' => 'admin@uos.edu.pk','group' => 'contact'],
    //     //     ['key' => 'admission_open','value' => 'true',            'group' => 'admission'],
    //     // ];
    //     // foreach ($settings as $s) {
    //     //     DB::table('settings')->insert(array_merge($s, [
    //     //         'college_id' => $collegeId,
    //     //         'created_at' => Carbon::now(),
    //     //         'updated_at' => Carbon::now(),
    //     //     ]));
    //     // }

    //     // Safe to run multiple times — won't duplicate
    //     $collegeId = DB::table('colleges')->where('slug', 'uos')->value('id');

    //     if (!$collegeId) {
    //         $collegeId = DB::table('colleges')->insertGetId([
    //             'name'        => 'Example College',
    //             'slug'        => 'uos',
    //             'email'       => 'admin@uos.edu.pk',
    //             'phone'       => '0300-0000000',
    //             'city'        => 'Karachi',
    //             'province'    => 'Sindh',
    //             'status'      => 'approved',
    //             'approved_at' => Carbon::now(),
    //             'created_at'  => Carbon::now(),
    //             'updated_at'  => Carbon::now(),
    //         ]);
    //     }

    //     // Default CMS pages — skip if already exist
    //     $pages = ['Home', 'About', 'Admissions', 'Contact'];
    //     foreach ($pages as $i => $page) {
    //         $slug = strtolower($page);
    //         $exists = DB::table('cms_pages')
    //                     ->where('college_id', $collegeId)
    //                     ->where('slug', $slug)
    //                     ->exists();
    //         if (!$exists) {
    //             DB::table('cms_pages')->insert([
    //                 'college_id'   => $collegeId,
    //                 'title'        => $page,
    //                 'slug'         => $slug,
    //                 'content'      => "<h1>$page</h1><p>Content coming soon.</p>",
    //                 'is_published' => true,
    //                 'sort_order'   => $i,
    //                 'created_at'   => Carbon::now(),
    //                 'updated_at'   => Carbon::now(),
    //             ]);
    //         }
    //     }

    //     // Default settings — skip if already exist
    //     $settings = [
    //         ['key' => 'logo',           'value' => null,               'group' => 'branding'],
    //         ['key' => 'primary_color',  'value' => '#1e40af',          'group' => 'branding'],
    //         ['key' => 'contact_email',  'value' => 'admin@uos.edu.pk', 'group' => 'contact'],
    //         ['key' => 'admission_open', 'value' => 'true',             'group' => 'admission'],
    //     ];
    //     foreach ($settings as $s) {
    //         $exists = DB::table('settings')
    //                     ->where('college_id', $collegeId)
    //                     ->where('key', $s['key'])
    //                     ->exists();
    //         if (!$exists) {
    //             DB::table('settings')->insert(array_merge($s, [
    //                 'college_id' => $collegeId,
    //                 'created_at' => Carbon::now(),
    //                 'updated_at' => Carbon::now(),
    //             ]));
    //         }
    //     }

    //     $this->command->info("CollegeSeeder done — college_id: {$collegeId}");


    // }

    public function run(): void
    {
        // Create (or find) the example college.
        $college = \App\Models\College::firstOrCreate(
            ['slug' => 'uos'],
                [
                    'name'        => 'Example College',
                    'email'       => 'admin@uos.edu.pk',
                    'phone'       => '0300-0000000',
                    'city'        => 'Karachi',
                    'province'    => 'Sindh',
                    'status'      => 'approved',
                    'approved_at' => \Illuminate\Support\Carbon::now(),
                ]
        );

        // Initialize it the SAME way a real approved college is initialized:
        // roles (college_admin + student), CMS pages, settings.
        // This is the single source of truth — no duplicated seeding logic here.
        app(\App\Services\CollegeInitializationService::class)->initialize($college);

        // Now that this college's roles exist, grant them their privileges.
        // (Program/Challan privilege seeders also do this, but they run after
        //  CollegeSeeder in DatabaseSeeder, so calling them is what wires grants.)

        $this->command->info("CollegeSeeder done — college_id: {$college->id}");
    }
}
