<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Backfills any per-college settings that are missing, using default values.
 *
 * Idempotent: uses firstOrCreate keyed on (college_id, key), so it only adds
 * rows that don't already exist and never overwrites an existing value. Safe
 * to run repeatedly and on every deploy. Keeps existing colleges in sync when
 * new settings keys are introduced in code (seedSettings covers new colleges;
 * this covers the ones already created).
 */
class SettingsBackfillSeeder extends Seeder
{
    public function run(): void
    {
        // Default value + group for every setting a college is expected to have.
        // Keep this list aligned with CollegeInitializationService@seedSettings.
        // Note: contact_email / contact_phone default to null here because their
        // real defaults come from the college row at creation time; we only
        // backfill the KEY so the settings UI/update can manage it.
        $defaults = [
            'primary_color'             => ['value' => '#1e40af',     'group' => 'branding'],
            'logo'                      => ['value' => null,          'group' => 'branding'],
            'contact_email'             => ['value' => null,          'group' => 'contact'],
            'contact_phone'             => ['value' => null,          'group' => 'contact'],
            'admission_open'            => ['value' => 'false',       'group' => 'admission'],
            'allow_multiple_admissions' => ['value' => 'false',       'group' => 'admissions'],
            'auto_generate_challan'     => ['value' => 'true',        'group' => 'fees'],
            'late_fee_mode'             => ['value' => 'off',         'group' => 'fees'],
            'late_fee_amount'           => ['value' => '0',           'group' => 'fees'],
            'late_fee_partial'          => ['value' => 'from_day_one','group' => 'fees'],
        ];

        // withoutGlobalScopes: run in CLI with no "current college", so we must
        // bypass the BelongsToTenant scope to see and touch every college.
        $collegeIds = College::withoutGlobalScopes()->pluck('id');

        $created = 0;
        foreach ($collegeIds as $collegeId) {
            foreach ($defaults as $key => $meta) {
                $setting = Setting::withoutGlobalScopes()->firstOrCreate(
                    ['college_id' => $collegeId, 'key' => $key],
                    ['value' => $meta['value'], 'group' => $meta['group']]
                );
                if ($setting->wasRecentlyCreated) {
                    $created++;
                }
            }
        }

        $this->command->info("SettingsBackfillSeeder done. Created {$created} missing setting row(s) across {$collegeIds->count()} college(s).");
    }
}