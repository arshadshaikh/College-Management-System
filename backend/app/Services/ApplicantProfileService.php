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
        /**
     * The applicant document types THIS college asks for.
     * Master list (super admin, active only) + the college's own choices
     * (Required / Optional / Not asked). `is_mandatory` on each item is the
     * effective value for this college. With no college choice, level documents
     * (education_level set) default to Required and others use the master flag.
     * A level document only counts when its level is required (see levels()).
     */
    public function documentTypes(int $collegeId)
    {
        $choices = CollegeDocumentType::where('college_id', $collegeId)
            ->get()->keyBy('required_document_type_id');

        return RequiredDocumentType::where('scope', self::DOC_SCOPE)
            ->where('is_active', true)
            ->orderBy('sort_order')->orderBy('name')
            ->get()
            ->filter(fn ($t) => $choices->get($t->id)?->is_active ?? true)
            ->map(function ($t) use ($choices) {
                $choice = $choices->get($t->id);
                $t->is_mandatory = $choice
                    ? (bool) $choice->is_required
                    : ($t->education_level ? true : (bool) $t->is_mandatory);
                return $t;
            })
            ->values();
    }

    // Slugs of document types linked to an education level (Document Types screen).
    public function certificateSlugs(): array
    {
        return RequiredDocumentType::where('scope', self::DOC_SCOPE)
            ->whereNotNull('education_level')
            ->pluck('slug')->all();
    }

    /**
     * Education levels (config/admission.php) with, for this college:
     * `required` (college baseline + $extraLevels) and `documents` asked at that
     * level: [['slug','name','required'], ...]. `document` = first slug (older screens).
     */
    public function levels(int $collegeId, array $extraLevels = [], $docTypes = null)
    {
        $required = array_values(array_unique(array_merge($this->requiredLevels($collegeId), $extraLevels)));
        $docTypes ??= $this->documentTypes($collegeId);

        return collect(config('admission.education_levels', []))
            ->map(function ($meta, $key) use ($required, $docTypes) {
                $docs = $docTypes->where('education_level', $key)->values()
                    ->map(fn ($t) => ['slug' => $t->slug, 'name' => $t->name, 'required' => (bool) $t->is_mandatory, 'system' => $t->education_system])
                    ->all();

                return array_merge(Arr::except($meta, ['document']), [
                    'key'       => $key,
                    'required'  => in_array($key, $required),
                    'documents' => $docs,
                    'document'  => $docs[0]['slug'] ?? null,
                ]);
            })
            ->values();
    }

    public function completeness(User $user, int $collegeId, array $extraLevels = []): array
    {
        $profile    = StudentProfile::where('user_id', $user->id)->first();
        $educations = $user->educations()->get();
        $documents  = $user->profileDocuments()->get();
        $docTypes   = $this->documentTypes($collegeId);
        $levels     = $this->levels($collegeId, $extraLevels, $docTypes);

        $missing = [];

        foreach (self::REQUIRED_PERSONAL as $field) {
            $value = in_array($field, ['name', 'phone']) ? $user->{$field} : $profile?->{$field};
            if (blank($value)) $missing[] = ['section' => 'personal', 'key' => $field, 'label' => self::PERSONAL_LABELS[$field] ?? ucwords(str_replace('_', ' ', $field))];
        }

        // A level counts as done only when saved, and, for levels with groups (Intermediate), with its group chosen.
        // A locked profile (application under review / approved) can't be edited, so a group missing
        // from before the dropdown existed is not held against it.
        $locked = $this->lockingApplication($user) !== null;
        $haveLevels = $educations
            ->filter(fn ($e) => $locked || empty(config("admission.education_levels.{$e->level}.groups")) || filled($e->study_group))
            ->pluck('level')->all();
        foreach ($levels->where('required', true) as $level) {
            if (!in_array($level['key'], $haveLevels)) {
                $missing[] = ['section' => 'education', 'key' => $level['key'], 'label' => $level['label']];
            }
        }
        
        // A level's system as chosen on the student's row (default: the level's first system, e.g. Matric).
        $systemOf = function ($key) use ($educations) {
            $systems = config("admission.education_levels.{$key}.systems", []);
            return $educations->firstWhere('level', $key)?->system ?? array_key_first($systems);
        };

        // General documents the college requires + the required documents of every required level.
        // A document limited to one system (e.g. IBCC => O Level) only counts for that system.
        $needDocs = $docTypes->whereNull('education_level')->where('is_mandatory', true)->pluck('slug')
            ->merge($levels->where('required', true)->flatMap(fn ($l) => collect($l['documents'])
                ->where('required', true)
                ->filter(fn ($d) => !$d['system'] || $d['system'] === $systemOf($l['key']))
                ->pluck('slug')))
            ->unique()->values();

        $haveDocs = $documents->pluck('document_type')->all();
        foreach ($needDocs as $slug) {
            if (!in_array($slug, $haveDocs)) {                
                $t = $docTypes->firstWhere('slug', $slug);
                $missing[] = ['section' => $t?->education_level ? 'education' : 'documents', 'key' => $slug,
                              'label' => $t?->name ?? $slug];
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

    /**
     * The application that currently locks this student's profile, or null.
     * Statuses that lock are set in config/admission.php ('lock_profile_statuses').
     * 'returned' (sent back for correction) never locks.
     */
    public function lockingApplication(User $user): ?\App\Models\Application
    {
        $statuses = config('admission.lock_profile_statuses', ['under_review', 'shortlisted', 'approved']);

        return \App\Models\Application::where('student_id', $user->id)
            ->whereIn('status', $statuses)
            ->latest('id')
            ->first();
    }

     
    /**
     * After approval: the profile fields this student may still edit
     * (college setting post_approval_editable_fields), or null when the normal rules apply
     * (no lock at all = everything editable; under_review / shortlisted = fully locked).
     */
    public function postApprovalFields(User $user, int $collegeId): ?array
    {
        $apps = \App\Models\Application::where('student_id', $user->id);
        $fullLock = array_diff(config('admission.lock_profile_statuses', []), ['approved']);
        if ((clone $apps)->whereIn('status', $fullLock)->exists()) return null;
        if (!(clone $apps)->where('status', 'approved')->exists()) return null;
        $value = Setting::where('college_id', $collegeId)
            ->where('key', 'post_approval_editable_fields')->value('value');
        $known = array_keys(config('admission.post_approval_field_options', []));
        
        return array_values(array_intersect($known, array_map('trim', explode(',', (string) $value))));
    
    }

}
