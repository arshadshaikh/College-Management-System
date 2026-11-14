<?php

namespace Database\Seeders;

use App\Models\College;
use App\Services\DefaultCollegeSite;
use Illuminate\Database\Seeder;

/**
 * Gives existing colleges the default public website that new colleges get
 * from CollegeInitializationService (starter pages + header menu).
 *
 * Safe to re-run: DefaultCollegeSite only fills pages that still say
 * "Content coming soon.", never recreates deleted pages, and only adds menu
 * items to colleges that have none. The platform tenant is skipped.
 */
class CollegeSiteBackfillSeeder extends Seeder
{
    public function run(): void
    {
        $site = app(DefaultCollegeSite::class);
        $count = 0;

        College::where('is_platform', false)->orderBy('id')->each(function (College $college) use ($site, &$count) {
            $site->seed($college);
            $count++;
        });

        $this->command?->info("CollegeSiteBackfillSeeder done. Checked {$count} college(s).");
    }
}
