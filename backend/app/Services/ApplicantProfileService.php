<?php

namespace App\Services;

use App\Models\CollegeDocumentType;
use App\Models\RequiredDocumentType;
use App\Models\Setting;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Support\Arr;

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

    // Readable names for the "Still needed" lists (profile page and Apply banner).
    public const PERSONAL_LABELS = [
        'name' => 'Full Name', 'phone' => 'Mobile Number', 'father_name' => "Father's Name",
        'date_of_birth' => 'Date of Birth', 'gender' => 'Gender', 'nationality' => 'Nationality',
        'domicile_province' => 'Domicile Province', 'domicile_district' => 'Domicile District',
        'permanent_address' => 'Permanent Address',
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

    /**
     * The applicant document types THIS college asks for.
     * Master list (super admin, active only) + the college's own choices.
     * No college row = master is_mandatory applies. `is_mandatory` on each
     * returned item is the effective value for this college.
     * Education certificates (config/admission.php) ignore college choices:
     * they are always listed and required when their level is required.
     */
    public function documentTypes(int $collegeId)
    {
        $choices = CollegeDocumentType::where('college_id', $collegeId)
            ->get()->keyBy('required_document_type_id');
        $certs = $this->certificateSlugs();

        return RequiredDocumentType::where('scope', self::DOC_SCOPE)
            ->where('is_active', true)
            ->orderBy('sort_order')->orderBy('name')
            ->get()
            ->filter(fn ($t) => in_array($t->slug, $certs) || ($choices->get($t->id)?->is_active ?? true))
            ->map(function ($t) use ($choices, $certs) {
                $choice = $choices->get($t->id);
                if ($choice && !in_array($t->slug, $certs)) $t->is_mandatory = $choice->is_required;
                return $t;
            })
            ->values();
    }

    // Document slugs tied to an education level (matric_certificate, ...).
    public function certificateSlugs(): array
    {
        return collect(config('admission.education_levels', []))->pluck('document')->filter()->values()->all();
    }

    public function completeness(User $user, int $collegeId, array $extraLevels = []): array
    {
        $profile    = StudentProfile::where('user_id', $user->id)->first();
        $educations = $user->educations()->get();
        $documents  = $user->profileDocuments()->get();
        // College baseline + any extra levels (e.g. the chosen program's).
        $required   = array_values(array_unique(array_merge($this->requiredLevels($collegeId), $extraLevels)));

        $levels = collect(config('admission.education_levels', []))
            ->map(fn ($meta, $key) => $meta + ['key' => $key, 'required' => in_array($key, $required)])
            ->values();

        $docTypes = $this->documentTypes($collegeId);

        $missing = [];

        foreach (self::REQUIRED_PERSONAL as $field) {
            $value = in_array($field, ['name', 'phone']) ? $user->{$field} : $profile?->{$field};
            if (blank($value)) $missing[] = ['section' => 'personal', 'key' => $field, 'label' => self::PERSONAL_LABELS[$field] ?? ucwords(str_replace('_', ' ', $field))];
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

    /**
     * A frozen copy of what the student submits with an application:
     * account + profile fields, education rows and the profile documents (id + version).
     */
    public function snapshot(User $user): array
    {
        $profile = StudentProfile::where('user_id', $user->id)->first();
        $skip = ['id', 'user_id', 'student_id', 'college_id', 'created_at', 'updated_at'];

        return [
            'taken_at'   => now()->toIso8601String(),
            'user'       => $user->only(['name', 'cnic_no', 'phone', 'email']),
            'profile'    => $profile ? Arr::except($profile->toArray(), $skip) : [],
            'educations' => $user->educations()->get()
                ->map(fn ($e) => Arr::except($e->toArray(), array_merge($skip, ['document_id'])))
                ->keyBy('level')->all(),
            'documents'  => $user->profileDocuments()->get()
                ->mapWithKeys(fn ($d) => [$d->document_type => [
                    'id'         => $d->id,
                    'updated_at' => optional($d->updated_at)->toIso8601String(),
                ]])->all(),
        ];
    }

    /**
     * What changed in the student's profile since $snapshot was taken.
     * Returns readable lines, e.g. "Domicile District", "Intermediate / HSSC: Obtained Marks",
     * "Document replaced: CNIC / B-Form". Empty array = nothing changed.
     */
    public function changesSince(?array $snapshot, User $user): array
    {
        if (!$snapshot) return [];
        $now     = $this->snapshot($user);
        $catalog = config('admission.education_levels', []);
        $label   = fn ($k) => self::PERSONAL_LABELS[$k] ?? ucwords(str_replace('_', ' ', $k));
        $changes = [];

        $before = ($snapshot['user'] ?? []) + ($snapshot['profile'] ?? []);
        $after  = $now['user'] + $now['profile'];
        foreach (array_unique(array_merge(array_keys($before), array_keys($after))) as $k) {
            if ((string) ($before[$k] ?? '') !== (string) ($after[$k] ?? '')) $changes[] = $label($k);
        }

        $eb = $snapshot['educations'] ?? [];
        $ea = $now['educations'];
        foreach (array_unique(array_merge(array_keys($eb), array_keys($ea))) as $lvl) {
            $name = $catalog[$lvl]['label'] ?? $lvl;
            if (!isset($eb[$lvl])) { $changes[] = "{$name}: added"; continue; }
            if (!isset($ea[$lvl])) { $changes[] = "{$name}: removed"; continue; }
            foreach (array_unique(array_merge(array_keys($eb[$lvl]), array_keys($ea[$lvl]))) as $f) {
                if ((string) ($eb[$lvl][$f] ?? '') !== (string) ($ea[$lvl][$f] ?? '')) $changes[] = "{$name}: " . $label($f);
            }
        }

        $names = RequiredDocumentType::where('scope', self::DOC_SCOPE)->pluck('name', 'slug');
        $db = $snapshot['documents'] ?? [];
        $da = $now['documents'];
        foreach (array_unique(array_merge(array_keys($db), array_keys($da))) as $slug) {
            $name = $names[$slug] ?? $slug;
            if (!isset($db[$slug]))      $changes[] = "Document added: {$name}";
            elseif (!isset($da[$slug]))  $changes[] = "Document removed: {$name}";
            elseif ($db[$slug] != $da[$slug]) $changes[] = "Document replaced: {$name}";
        }

        return array_values(array_unique($changes));
    }
}
