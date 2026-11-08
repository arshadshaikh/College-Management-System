<?php

namespace Database\Seeders;

use App\Models\RequiredDocumentType;
use Illuminate\Database\Seeder;

/**
 * Default applicant-profile document types (scope: student_application).
 * Idempotent: firstOrCreate on (scope, slug); never overwrites super-admin edits.
 * Slugs match the old documents.document_type enum so existing files keep matching.
 */
class StudentDocumentTypeSeeder extends Seeder
{
    public function run(): void
    {
        $img = 'image/jpeg,image/png';
        $doc = 'image/jpeg,image/png,application/pdf';

        $types = [
            // slug                     name                              mandatory mime  max_kb
            ['photo',                  'Photograph',                       true,  $img, 1024],
            ['cnic',                   'CNIC / B-Form',                    true,  $doc, 2048],
            ['domicile',               'Domicile Certificate',             false, $doc, 2048],
            ['prc',                    'PRC (Permanent Residence Cert.)',  false, $doc, 2048],
            ['matric_certificate',     'Matric / SSC Certificate',         true,  $doc, 2048],
            ['inter_certificate',      'Intermediate / HSSC Certificate',  true,  $doc, 2048],
            ['bachelors_degree',       "Bachelor's Degree / Transcript",   false, $doc, 4096],
            ['masters_degree',         "Master's Degree / Transcript",     false, $doc, 4096],
            ['mphil_degree',           'M.Phil / MS Degree / Transcript',  false, $doc, 4096],
            ['character_certificate',  'Character Certificate',            false, $doc, 2048],
        ];

        $created = 0;
        foreach ($types as $i => [$slug, $name, $mandatory, $mime, $kb]) {
            $row = RequiredDocumentType::firstOrCreate(
                ['scope' => 'student_application', 'slug' => $slug],
                [
                    'name'               => $name,
                    'is_mandatory'       => $mandatory,
                    'is_active'          => true,
                    'sort_order'         => ($i + 1) * 10,
                    'allowed_mime_types' => $mime,
                    'max_size_kb'        => $kb,
                ]
            );
            if ($row->wasRecentlyCreated) $created++;
        }

        $this->command->info("StudentDocumentTypeSeeder done. Created {$created} document type(s).");
    }
}