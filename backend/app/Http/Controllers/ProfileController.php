<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\RequiredDocumentType;
use App\Models\Setting;
use App\Models\StudentEducation;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

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
    public function update(Request $request)
    {
        $data = $request->validate([
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
        ]);

        $user = $request->user();
        $accountKeys = ['name', 'phone', 'email'];

        DB::transaction(function () use ($user, $data, $accountKeys) {
            $user->forceFill(array_intersect_key($data, array_flip($accountKeys)))->save();

            $profile = StudentProfile::firstOrNew(['user_id' => $user->id]);
            $profile->fill(array_diff_key($data, array_flip($accountKeys)));
            if (!$profile->exists) {
                $profile->college_id = app('current_college')->id;
                $profile->cnic       = $user->cnic_no;
            }
            $profile->save();
        });

        return response()->json(['message' => 'Profile saved.'] + $this->payload($user->fresh()));
    }

    // PUT /api/profile/educations   (body: level + fields)
    public function saveEducation(Request $request)
    {
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
            'cgpa'             => 'nullable|required_without:total_marks|numeric|min:0|lte:cgpa_scale',
            'cgpa_scale'       => 'nullable|required_with:cgpa|numeric|in:4,5',
        ]);

        $user = $request->user();

        $level = $data['level'];
        unset($data['level']);

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
        $user = $request->user();
        $user->educations()->whereKey($education)->delete();   // own rows only

        return response()->json(['message' => 'Education removed.'] + $this->payload($user));
    }

    // POST /api/profile/documents   (multipart: document_type, file)
    public function uploadDocument(Request $request)
    {
        $request->validate([
            'document_type' => ['required', 'string', Rule::exists('required_document_types', 'slug')
                ->where('scope', self::DOC_SCOPE)->where('is_active', true)],
        ]);

        $type = RequiredDocumentType::where('scope', self::DOC_SCOPE)
            ->where('slug', $request->document_type)->firstOrFail();

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

            // Attach to the matching education row, if this is a certificate.
            foreach (config('admission.education_levels', []) as $level => $meta) {
                if (($meta['document'] ?? null) === $type->slug) {
                    $user->educations()->where('level', $level)->update(['document_id' => $document->id]);
                }
            }

            return $document;
        });

        return response()->json(['message' => "{$type->name} uploaded.", 'document' => $document] + $this->payload($user), 201);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private function requiredLevels(): array
    {
        $value = Setting::where('college_id', app('current_college')->id)
            ->where('key', 'required_education_levels')
            ->value('value');

        return array_values(array_filter(array_map('trim', explode(',', (string) $value))));
    }

    private function payload(User $user): array
    {
        $profile    = StudentProfile::where('user_id', $user->id)->first();
        $educations = $user->educations()->get();
        $documents  = $user->profileDocuments()->get();
        $required   = $this->requiredLevels();

        $levels = collect(config('admission.education_levels', []))
            ->map(fn ($meta, $key) => $meta + ['key' => $key, 'required' => in_array($key, $required)])
            ->values();

        $docTypes = RequiredDocumentType::where('scope', self::DOC_SCOPE)
            ->where('is_active', true)
            ->orderBy('sort_order')->orderBy('name')
            ->get(['name', 'slug', 'is_mandatory', 'allowed_mime_types', 'max_size_kb', 'max_dimension']);

        return [
            'user'           => $user->only(['id', 'name', 'cnic_no', 'phone', 'email']),
            'profile'        => $profile,
            'educations'     => $educations,
            'documents'      => $documents,
            'levels'         => $levels,
            'document_types' => $docTypes,
            'completeness'   => $this->completeness($user, $profile, $educations, $documents, $levels, $docTypes),
        ];
    }

    private function completeness(User $user, ?StudentProfile $profile, $educations, $documents, $levels, $docTypes): array
    {
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

        // Mandatory types + the certificate of every required level.
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
