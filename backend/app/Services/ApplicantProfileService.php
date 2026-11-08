<?php

namespace App\Services;

use App\Models\RequiredDocumentType;
use App\Models\Setting;
use App\Models\StudentProfile;
use App\Models\User;

/**
 * Applicant-profile rules shared by ProfileController (student page)
 * and ApplicationController (apply gate).
 * Data (levels, document types, required levels) comes from settings/DB;
 * the completeness logic lives here.
 */
class ApplicantProfileService
{
    public const DOC_SCOPE = 'student_application';

    // Personal fields that count towards completeness.
    public const REQUIRED_PERSONAL = [
        'name', 'phone', 'father_name', 'date_of_birth', 'gender',
        'nationality', 'domicile_province', 'domicile_district', 'permanent_address',
    ];

    // Level keys the college requires (setting `required_education_levels`).
    public function requiredLevels(int $collegeId): array
    {
        $value = Setting::where('college_id', $collegeId)
            ->where('key', 'required_education_levels')
            ->value('value');

        return array_values(array_filter(array_map('trim', explode(',', (string) $value))));
    }

    // Does the college block applying until the profile is complete? (default: yes)
    public function requiresCompleteProfile(int $collegeId): bool
    {
        $value = Setting::where('college_id', $collegeId)
            ->where('key', 'require_complete_profile')
            ->value('value');

        return $value === null ? true : $value === 'true';
    }

    public function completeness(User $user, int $collegeId): array
    {
        $profile    = StudentProfile::where('user_id', $user->id)->first();
        $educations = $user->educations()->get();
        $documents  = $user->profileDocuments()->get();
        $required   = $this->requiredLevels($collegeId);

        $levels = collect(config('admission.education_levels', []))
            ->map(fn ($meta, $key) => $meta + ['key' => $key, 'required' => in_array($key, $required)])
            ->values();

        $docTypes = RequiredDocumentType::where('scope', self::DOC_SCOPE)
            ->where('is_active', true)
            ->get(['name', 'slug', 'is_mandatory']);

        $missing = [];

        foreach (self::REQUIRED_PERSONAL as $field) {
            $value = in_array($field, ['name', 'phone']) ? $user->{$field} : $profile?->{$field};
            if (blank($value)) $missing[] = ['section' => 'personal', 'key' => $field];
        }

        $haveLevels = $educations->pluck('level')->all();
        foreach ($levels->where('required', true) as $level) {
            if (!in_array($level['key'], $haveLevels)) {
                $missing[] = ['section' => 'education', 'key' => $level['key'], 'label' => $level['label']];
            }
        }

        // Mandatory document types + the certificate of every required level.
        $needDocs = $docTypes->where('is_mandatory', true)->pluck('slug')
            ->merge($levels->where('required', true)->pluck('document')->filter())
            ->unique();
        $haveDocs = $documents->pluck('document_type')->all();
        foreach ($needDocs as $slug) {
            if (!in_array($slug, $haveDocs)) {
                $missing[] = ['section' => 'documents', 'key' => $slug,
                              'label' => $docTypes->firstWhere('slug', $slug)?->name ?? $slug];
            }
        }

        $total = count(self::REQUIRED_PERSONAL) + $levels->where('required', true)->count() + $needDocs->count();
        $done  = $total - count($missing);

        return [
            'percent'  => $total ? (int) floor($done * 100 / $total) : 100,
            'complete' => empty($missing),
            'missing'  => $missing,
        ];
    }
}
