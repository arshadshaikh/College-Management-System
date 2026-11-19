<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\RequiredDocumentType;
use App\Models\Setting;
use App\Models\StudentEducation;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\ApplicantProfileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;


class ProfileController extends Controller
{
    private const DOC_SCOPE = 'student_application';

    // Personal fields that count towards completeness (logic in code).
    private const REQUIRED_PERSONAL = [
        'name', 'phone', 'father_name', 'date_of_birth', 'gender',
        'nationality', 'domicile_province', 'domicile_district', 'permanent_address',
    ];

    // GET /api/profile
    public function show(Request $request)
    {
        return response()->json($this->payload($request->user()));
    }

    // PUT /api/profile
    // After approval only the fields in post_approval_editable_fields are saved (and audited).
    public function update(Request $request)
    {
        $user    = $request->user();
        $college = app('current_college');
        $open    = app(ApplicantProfileService::class)->postApprovalFields($user, $college->id);
        
        if ($open === null) {
            $this->ensureEditable($user);          // 423 while under review / shortlisted
        } elseif (!$open) {
            return response()->json(['message' => 'Your application is approved and this college does not allow profile changes. Contact the admissions office.'], 423);
        }
        
        $rules = [
            'name'              => 'required|string|max:255',
            'phone'             => 'nullable|string|max:20',
            'email'             => 'nullable|email|max:255',
            'father_name'       => 'required|string|max:255',
            'date_of_birth'     => 'nullable|date|before:today',
            'gender'            => 'nullable|in:male,female,other',
            'nationality'       => 'nullable|string|max:100',
            'religion'          => 'nullable|string|max:100',
            'marital_status'    => 'nullable|in:single,married,divorced,widowed',
            'domicile_province' => 'nullable|string|max:100',
            'domicile_district' => 'nullable|string|max:100',
            'prc_no'            => 'nullable|string|max:50',
            'permanent_address' => 'nullable|string|max:1000',
            'present_address'   => 'nullable|string|max:1000',
            'emergency_contact' => 'nullable|string|max:255',
        ];
        
        if ($open !== null) {
            // Locked fields in the request are ignored, not saved.
            $rules = array_intersect_key($rules, array_flip($open));
        }
        
        $data = $request->validate($rules);
        
        if ($open !== null) {
            $data = array_intersect_key($data, array_flip($open));
        }

        $accountKeys = ['name', 'phone', 'email'];
        
        DB::transaction(function () use ($user, $data, $accountKeys, $college, $open) {
            $profile = StudentProfile::firstOrNew(['user_id' => $user->id]);
            // Old values, for the audit log after approval.
            $old = [];
            foreach ($data as $k => $v) {
                $old[$k] = in_array($k, $accountKeys) ? $user->{$k} : $profile->{$k};
            }
            
            $user->forceFill(array_intersect_key($data, array_flip($accountKeys)))->save();
            $profile->fill(array_diff_key($data, array_flip($accountKeys)));
            
            if (!$profile->exists) {
                $profile->college_id = $college->id;
                $profile->cnic       = $user->cnic_no;
            }
            
            $profile->save();
            
            if ($open !== null) {
                $changedNew = [];
                $changedOld = [];
                foreach ($data as $k => $v) {
                    if ((string) $old[$k] !== (string) $v) {
                        $changedNew[$k] = $v;
                        $changedOld[$k] = $old[$k];
                    }
                }
                
                if ($changedNew) {
                    \App\Models\AuditLog::record('profile.updated_after_approval', $user, $changedNew, $changedOld);
                }
            }
        });
        
        return response()->json(['message' => 'Profile saved.'] + $this->payload($user->fresh()));
    }


    // PUT /api/profile/educations   (body: level + fields)
    public function saveEducation(Request $request)
    {
        $this->ensureEditable($request->user());
        $catalog = config('admission.education_levels', []);

        $data = $request->validate([
            'level'            => ['required', Rule::in(array_keys($catalog))],
            'degree_title'     => 'nullable|string|max:255',
            'board_university' => 'required|string|max:255',
            'institution'      => 'nullable|string|max:255',
            'roll_no'          => 'nullable|string|max:50',
            'passing_year'     => 'required|integer|min:1950|max:' . date('Y'),
            'total_marks'      => 'nullable|required_without:cgpa|integer|min:1',
            'obtained_marks'   => 'nullable|required_with:total_marks|integer|min:0|lte:total_marks',
            'grade'            => 'nullable|string|max:10',
            // Matric / O Level, Intermediate / A Level ... (config admission.education_levels.*.systems)
            'system'           => [
                \Illuminate\Validation\Rule::requiredIf(fn () => !empty($catalog[$request->input('level')]['systems'] ?? [])),
                'nullable', 'string',
                \Illuminate\Validation\Rule::in(array_keys($catalog[$request->input('level')]['systems'] ?? [])),
            ],
            'grades_summary'   => [
                \Illuminate\Validation\Rule::requiredIf(fn () => !empty($catalog[$request->input('level')]['systems'][$request->input('system')]['grades'] ?? false)),
                'nullable', 'string', 'max:255',
            ],
            'cgpa'             => 'nullable|required_without:total_marks|numeric|min:0|lte:cgpa_scale',
            'cgpa_scale'       => 'nullable|required_with:cgpa|numeric|in:4,5',
        ]);

        // Grades only belong to grade-based systems (O / A Level).
        if (empty($catalog[$data['level'] ?? '']['systems'][$data['system'] ?? '']['grades'])) {
            $data['grades_summary'] = null;
        }

        $user = $request->user();

        $level = $data['level'];
        unset($data['level']);

        // Higher levels must be passed after lower ones (order = config/admission.php).
        $order = array_keys($catalog);
        $pos   = array_search($level, $order);
        foreach ($user->educations()->where('level', '!=', $level)->get(['level', 'passing_year']) as $other) {
            $otherPos = array_search($other->level, $order);
            if ($otherPos === false || !$other->passing_year) continue;
            $label = $catalog[$other->level]['label'];
            if ($otherPos < $pos && $data['passing_year'] <= $other->passing_year) {
                throw ValidationException::withMessages(['passing_year' => "Must be after your {$label} year ({$other->passing_year})."]);
            }
            if ($otherPos > $pos && $data['passing_year'] >= $other->passing_year) {
                throw ValidationException::withMessages(['passing_year' => "Must be before your {$label} year ({$other->passing_year})."]);
            }
        }
        
        // Passing year must be realistic for the student's date of birth.
        $dob    = $user->studentProfile?->date_of_birth;
        $minAge = $catalog[$level]['min_age'] ?? null;
        if ($dob && $minAge) {
            $earliest = \Carbon\Carbon::parse($dob)->year + (int) $minAge;
            if ($data['passing_year'] < $earliest) {
                throw ValidationException::withMessages([
                    'passing_year' => "Looks too early for your date of birth. For {$catalog[$level]['label']} the earliest possible year is {$earliest}.",
                ]);
            }
        }


        // Link the certificate if it was already uploaded.
        $docId = $user->profileDocuments()
            ->where('document_type', $catalog[$level]['document'] ?? '')
            ->value('id');

        StudentEducation::updateOrCreate(
            ['student_id' => $user->id, 'level' => $level],
            $data + ['college_id' => app('current_college')->id, 'document_id' => $docId]
        );

        return response()->json(['message' => 'Education saved.'] + $this->payload($user));
    }

    // DELETE /api/profile/educations/{id}
    public function destroyEducation(Request $request, int $education)
    {
        $this->ensureEditable($request->user());
        $user = $request->user();
        $user->educations()->whereKey($education)->delete();   // own rows only

        return response()->json(['message' => 'Education removed.'] + $this->payload($user));
    }

    // POST /api/profile/documents   (multipart: document_type, file)
    public function uploadDocument(Request $request)
    {
        $this->ensureEditable($request->user());

        $request->validate([
            'document_type' => ['required', 'string', Rule::exists('required_document_types', 'slug')
                ->where('scope', self::DOC_SCOPE)->where('is_active', true)],
        ]);
        
        $type = app(ApplicantProfileService::class)
            ->documentTypes(app('current_college')->id)
            ->firstWhere('slug', $request->document_type);
        abort_if(!$type, 422, 'This college does not ask for this document.');


        // File rules come from the configured document type.
        $fileRules = ['required', 'file', 'mimetypes:' . $type->allowed_mime_types, 'max:' . $type->max_size_kb];
        $file = $request->file('file');
        if ($type->max_dimension && $file && str_starts_with((string) $file->getMimeType(), 'image/')) {
            $fileRules[] = Rule::dimensions()->maxWidth($type->max_dimension)->maxHeight($type->max_dimension);
        }
        $request->validate(['file' => $fileRules]);

        $user    = $request->user();
        $college = app('current_college');

        $existing = $user->profileDocuments()->where('document_type', $type->slug)->first();
        if ($existing && $existing->verification_status === 'verified') {
            return response()->json(['message' => 'This document is already verified and cannot be replaced.'], 422);
        }

        $path = $file->store("colleges/{$college->id}/students/{$user->id}/profile", 'private');

        $document = DB::transaction(function () use ($existing, $user, $college, $type, $file, $path) {
            if ($existing) {
                Storage::disk('private')->delete($existing->stored_path);
                $existing->delete();
            }

            $document = Document::create([
                'college_id'          => $college->id,
                'application_id'      => null,      // profile document
                'student_id'          => $user->id,
                'document_type'       => $type->slug,
                'original_name'       => $file->getClientOriginalName(),
                'stored_path'         => $path,
                'mime_type'           => $file->getMimeType(),
                'file_size'           => $file->getSize(),
                'verification_status' => 'pending',
            ]);

            // Level certificates are matched by document type (education_level on the type),
            // so a level can have several (Pass, Marks, ...). educations.document_id is no longer used.

            return $document;
        });

        return response()->json(['message' => "{$type->name} uploaded.", 'document' => $document] + $this->payload($user), 201);
    }

    // GET /api/profile/documents/{id}/download   (own profile documents only)
    public function downloadDocument(Request $request, int $document)
    {
        $doc = $request->user()->profileDocuments()->whereKey($document)->firstOrFail();

        if (!Storage::disk('private')->exists($doc->stored_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return Storage::disk('private')->download($doc->stored_path, $doc->original_name);
    }

    // DELETE /api/profile/documents/{id}   (own, unverified profile documents only)
    public function destroyDocument(Request $request, int $document)
    {
        $user = $request->user();
        $this->ensureEditable($user);

        $doc = $user->profileDocuments()->whereKey($document)->firstOrFail();
        if ($doc->verification_status === 'verified') {
            return response()->json([
                'message' => 'A verified document cannot be removed. Contact the admissions office.',
            ], 422);
        }

        $name = \App\Models\RequiredDocumentType::where('scope', ApplicantProfileService::DOC_SCOPE)
            ->where('slug', $doc->document_type)->value('name') ?? 'Document';

        Storage::disk('private')->delete($doc->stored_path);
        $user->educations()->where('document_id', $doc->id)->update(['document_id' => null]);
        $doc->delete();

        return response()->json(['message' => "{$name} removed."] + $this->payload($user));
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private function requiredLevels(): array
    {
        $value = Setting::where('college_id', app('current_college')->id)
            ->where('key', 'required_education_levels')
            ->value('value');

        return array_values(array_filter(array_map('trim', explode(',', (string) $value))));
    }

    // Refuse profile edits while an application is being reviewed (config lock_profile_statuses).
    private function ensureEditable(User $user): void
    {
        $app = app(ApplicantProfileService::class)->lockingApplication($user);
        if ($app) {
            abort(response()->json([
                'message' => "Your profile is locked while application {$app->application_no} is "
                           . str_replace('_', ' ', $app->status)
                           . '. Contact the admissions office if something needs correcting.',
            ], 423));
        }
    }

    private function payload(User $user): array
    {
        $profile    = StudentProfile::where('user_id', $user->id)->first();
        $educations = $user->educations()->get();
        $documents  = $user->profileDocuments()->get();
        
        // Levels with `required` and the `documents` this college asks at each level.
        $levels = app(ApplicantProfileService::class)->levels(app('current_college')->id);

        $docTypes = app(ApplicantProfileService::class)->documentTypes(app('current_college')->id);

        return [
            'user'           => $user->only(['id', 'name', 'cnic_no', 'phone', 'email']),
            'profile'        => $profile,
            'educations'     => $educations,
            'documents'      => $documents,
            'levels'         => $levels,
            'document_types' => $docTypes,
            'completeness'   => app(ApplicantProfileService::class)->completeness($user, app('current_college')->id),
            'required_personal' => ApplicantProfileService::REQUIRED_PERSONAL,
            'locked' => ($lock = app(ApplicantProfileService::class)->lockingApplication($user))
                ? ['application_no' => $lock->application_no, 'status' => $lock->status,
                   'status_label' => str_replace('_', ' ', $lock->status)]
                : null,
            // Non-null only after approval: the fields the student may still edit.
            'editable_fields' => app(ApplicantProfileService::class)
                ->postApprovalFields($user, app('current_college')->id),
            'returned' => \App\Models\Application::with('program:id,name')
                ->where('student_id', $user->id)
                ->where('status', 'returned')
                ->latest('id')
                ->get(['id', 'application_no', 'program_id', 'correction_note']),
        ];
    }
}
