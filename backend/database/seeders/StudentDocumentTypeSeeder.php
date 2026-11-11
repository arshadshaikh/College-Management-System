<?php

namespace Database\Seeders;

use App\Models\RequiredDocumentType;
use Illuminate\Database\Seeder;

/**
 * Default applicant-profile document types (scope: student_application).
 * Safe to re-run: creates missing types; on existing rows it only FILLS an empty
 * education_level, and renames a type only while it still has its old default name.
 * Super-admin edits are never overwritten.
 */
class StudentDocumentTypeSeeder extends Seeder
{
    public function run(): void
    {
        $img = 'image/jpeg,image/png';
        $doc = 'image/jpeg,image/png,application/pdf';

        $types = [
            // slug                      name                                         level          mand.  mime  max_kb sort  old default name (for rename)
            ['photo',                    'Photograph',                                null,          true,  $img, 1024,  10, null],
            ['cnic',                     'CNIC / B-Form',                             null,          true,  $doc, 2048,  20, null],
            ['domicile',                 'Domicile Certificate',                      null,          false, $doc, 2048,  30, null],
            ['prc',                      'PRC (Permanent Residence Cert.)',           null,          false, $doc, 2048,  40, null],
            ['matric_certificate',       'Matric / O Level Pass Certificate',         'matric',      true,  $doc, 2048,  50, 'Matric / SSC Certificate'],
            ['matric_marks_certificate', 'Matric / O Level Marks Certificate',        'matric',      true,  $doc, 2048,  55, null],
            ['inter_certificate',        'Intermediate / A Level Pass Certificate',   'intermediate', true, $doc, 2048,  60, 'Intermediate / HSSC Certificate'],
            ['inter_marks_certificate',  'Intermediate / A Level Marks Certificate',  'intermediate', true, $doc, 2048,  65, null],
            ['bachelors_degree',         "Bachelor's Degree",                          'bachelors',  false, $doc, 4096,  70, "Bachelor's Degree / Transcript"],
            ['bachelors_transcript',     "Bachelor's Transcript / Marks Certificate",  'bachelors',  false, $doc, 4096,  75, null],
            ['masters_degree',           "Master's Degree",                            'masters',    false, $doc, 4096,  80, "Master's Degree / Transcript"],
            ['masters_transcript',       "Master's Transcript / Marks Certificate",    'masters',    false, $doc, 4096,  85, null],
            ['mphil_degree',             'M.Phil / MS Degree',                         'mphil',      false, $doc, 4096,  90, 'M.Phil / MS Degree / Transcript'],
            ['mphil_transcript',         'M.Phil / MS Transcript / Marks Certificate', 'mphil',      false, $doc, 4096,  95, null],
            ['character_certificate',    'Character Certificate',                     null,          false, $doc, 2048, 100, null],
        ];

        $created = 0;
        $updated = 0;
        foreach ($types as [$slug, $name, $level, $mandatory, $mime, $kb, $sort, $oldName]) {
            $row = RequiredDocumentType::firstOrCreate(
                ['scope' => 'student_application', 'slug' => $slug],
                [
                    'name'               => $name,
                    'education_level'    => $level,
                    'is_mandatory'       => $mandatory,
                    'is_active'          => true,
                    'sort_order'         => $sort,
                    'allowed_mime_types' => $mime,
                    'max_size_kb'        => $kb,
                ]
            );

            if ($row->wasRecentlyCreated) { $created++; continue; }

            // Existing row: fill gaps only.
            $changes = [];
            if ($level && !$row->education_level)      $changes['education_level'] = $level;
            if ($oldName && $row->name === $oldName)   $changes['name'] = $name;
            if ($changes) { $row->update($changes); $updated++; }
        }

        $this->command->info("StudentDocumentTypeSeeder done. Created {$created}, updated {$updated} document type(s).");
    }
}