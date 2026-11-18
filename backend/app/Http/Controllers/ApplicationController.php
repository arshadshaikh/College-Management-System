<?php

namespace App\Http\Controllers;

use App\Models\Application;
use App\Models\Document;
use App\Models\Program;
use App\Models\AuditLog;
use App\Services\ApplicantProfileService;
use App\Services\ChallanService;
use App\Services\PolicyService;
use App\Services\TimetableService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ApplicationController extends Controller
{
    public function __construct(private ChallanService $challanService)
    {
        // $this->challanService = $challanService;
    }
    // ── Student: browse their own applications ────────────────────
    // GET /api/applications/my
    public function myApplications(Request $request)
    {
        $applications = Application::with(['program', 'documents'])
            ->where('student_id', $request->user()->id)
            ->latest()
            ->paginate(15);

        return response()->json($applications);
    }

    // ── College admin: list all applications ──────────────────────
    // GET /api/applications
    public function index_old(Request $request)
    {
        $query = Application::with(['student', 'program', 'documents', 'reviewer']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('program_id')) {
            $query->where('program_id', $request->program_id);
        }

        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->whereHas('student', fn($q) => $q
                ->where('name', 'like', "%{$s}%")
                ->orWhere('cnic_no', 'like', "%{$s}%")
            )->orWhere('application_no', 'like', "%{$s}%");
        }

        return response()->json($query->latest()->paginate(15));
    }

    // ── College admin: list all applications ──────────────────────
    // GET /api/applications
    public function index(Request $request)
    {
        $query = Application::with(['student', 'program', 'documents', 'reviewer']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('program_id')) {
            $query->where('program_id', $request->program_id);
        }

        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            // Grouped so it can't break out of the status/program filters.
            $query->where(function ($q) use ($s) {
                $q->where('application_no', 'like', "%{$s}%")
                  ->orWhereHas('student', fn($sq) => $sq
                      ->where('name', 'like', "%{$s}%")
                      ->orWhere('cnic_no', 'like', "%{$s}%"));
            });
        }

        $sortable = ['application_no', 'status', 'admission_year', 'created_at', 'reviewed_at'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'created_at';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';

        $perPage = min(max((int) ($request->per_page ?? 15), 1), 1000);

        return response()->json($query->orderBy($sortBy, $sortDir)->paginate($perPage));

        // return response()->json($query->orderBy($sortBy, $sortDir)->paginate(15));
    }

    // ── Student: start/submit an application ──────────────────────
    // POST /api/applications
    public function store(Request $request)
    {
        $request->validate([
            'program_id'     => 'required|exists:programs,id',
            'semester_no'    => 'required|integer|min:1',
            'admission_year' => 'required|integer|min:2020|max:2099',
            // Shift the student wants to study in (Settings → Timetable). Optional when only one shift runs.
            'shift'          => ['nullable', 'string', \Illuminate\Validation\Rule::in(app(TimetableService::class)->enabledShifts())],
        ], [
            'shift.in' => 'Choose one of the shifts this college runs.',
        ]);

        $college = app('current_college');
        $student = $request->user();

        $program = Program::findOrFail($request->program_id);

        // Baseline levels (college setting) + this program's extra levels.
        $programLevels = array_values(array_filter(array_map('trim', explode(',', (string) $program->required_education_levels))));

        $profiles = app(ApplicantProfileService::class);
        if ($profiles->requiresCompleteProfile($college->id)) {
            $completeness = $profiles->completeness($student, $college->id, $programLevels);
            if (!$completeness['complete']) {
                return response()->json([
                    'message'      => "Please complete your admission profile before applying to {$program->name}.",
                    'completeness' => $completeness,
                ], 422);
            }
        }

        // Prevent duplicate active applications for the same program
        $duplicate = Application::where('student_id', $student->id)
            ->where('program_id', $program->id)
            ->whereNotIn('status', ['rejected', 'withdrawn'])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'You already have an active application for this program.',
            ], 422);
        }

        if ($program->availableSeats() === 0) {
            return response()->json([
                'message' => 'No seats available for this program.',
            ], 422);
        }

        $application = Application::create([
            'college_id'     => $college->id,
            'student_id'     => $student->id,
            'program_id'     => $program->id,
            'semester_no'    => $request->semester_no,
            'admission_year' => $request->admission_year,
            'shift'          => $request->shift ?: app(TimetableService::class)->enabledShifts()[0],
            'status'         => 'submitted',
            'profile_snapshot' => $profiles->snapshot($student),
            'submitted_at'     => now(),
        ]);

        return response()->json([
            'message'     => 'Application submitted successfully.',
            'application' => $application->load('program'),
        ], 201);
    }

    // ── College admin: view one application ───────────────────────
    // GET /api/applications/{application}
    public function show(Application $application)
    {
        $application->load([
            'student.studentProfile', 'student.educations', 'student.profileDocuments',
            'program', 'documents', 'reviewer',
        ]);

        return response()->json($application->toArray() + [
            // Labels for the admin view: level names and document type names.
            'education_levels' => config('admission.education_levels', []),
            'document_types'   => \App\Models\RequiredDocumentType::where('scope', 'student_application')->pluck('name', 'slug'),
            // slug => education level, so the admin view can group certificates by level.
            'document_levels' => \App\Models\RequiredDocumentType::where('scope', ApplicantProfileService::DOC_SCOPE)
                ->whereNotNull('education_level')->pluck('education_level', 'slug'),
            // Readable list of profile edits made after submitting (empty = unchanged).
            'profile_changes' => $application->profile_snapshot
                ? app(ApplicantProfileService::class)->changesSince($application->profile_snapshot, $application->student)
                : [],
            // Shifts this college runs, for the Shift row (label + change dropdown).
            'shift_options' => app(TimetableService::class)->shiftOptions(),
        ]);
    }

    // ── College admin: move a student to another shift ────────────
    // PUT /api/applications/{application}/shift
    public function updateShift(Request $request, Application $application)
    {
        $request->validate([
            'shift' => ['required', 'string', \Illuminate\Validation\Rule::in(app(TimetableService::class)->enabledShifts())],
        ], [
            'shift.in' => 'Choose one of the shifts this college runs.',
        ]);

        if (in_array($application->status, ['rejected', 'withdrawn'])) {
            return response()->json(['message' => 'This application is closed.'], 422);
        }

        $old = $application->shift;
        if ($old !== $request->shift) {
            DB::transaction(function () use ($application, $request, $old) {
                $application->update(['shift' => $request->shift]);
                AuditLog::record('application.shift_changed', $application, ['shift' => $request->shift], ['shift' => $old]);
            });
        }

        return response()->json([
            'message' => 'Shift updated.',
            'shift'   => $application->shift,
        ]);
    }

    // ── College admin: move to under_review ───────────────────────
    // POST /api/applications/{application}/review
    public function markUnderReview(Application $application)
    {
        if ($application->status !== 'submitted') {
            return response()->json([
                'message' => 'Only submitted applications can be marked for review.',
            ], 422);
        }

        $application->update(['status' => 'under_review']);

        return response()->json([
            'message'     => 'Application marked as under review.',
            'application' => $application->fresh(),
        ]);
    }

    // ── College admin: approve ────────────────────────────────────
    // POST /api/applications/{application}/approve
    public function approve(Request $request, Application $application)
    {
        if (!$application->canBeReviewed()) {
            return response()->json([
                'message' => 'This application cannot be approved in its current status.',
            ], 422);
        }
        
        // $application->update([
        //     'status'      => 'approved',
        //     'reviewed_by' => $request->user()->id,
        //     'reviewed_at' => now(),
        // ]);

        if (!PolicyService::allows('multiple_admissions_policy', 'allow_multiple_admissions', $application->college_id)) {
           $alreadyAdmitted = Application::where('student_id', $application->student_id)
            ->where('id', '!=', $application->id)
            ->whereIn('status', ['approved', 'shortlisted'])
            ->exists();

            if ($alreadyAdmitted) {
                return response()->json([
                    'message' => 'This student already has an admitted application. Multiple admissions are not permitted under current policy.',
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            $application->update([
                'status'      => 'approved',
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            // Auto-generate the first (Semester 1) challan — only if the policy allows it.
            // Platform can enforce; otherwise the college's auto_generate_challan setting decides.
            // Defaults to 'true' so existing behavior is preserved when unset.
            $challan = null;
            if (PolicyService::allows('auto_generate_challan_policy', 'auto_generate_challan', $application->college_id, 'true')) {
                $challan = $this->challanService->generateFirstChallan($application);
            }

            AuditLog::record('application.approved', $application, [
                'application_no' => $application->application_no,
                'challan_no'     => $challan?->challan_no,
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }


        return response()->json([
            'message'     => 'Application approved.',
            'application' => $application->fresh()->load('student', 'program'),
            'challan'     => $challan,
        ]);
    }

    // ── College admin: reject ─────────────────────────────────────
    // POST /api/applications/{application}/reject
    public function reject(Request $request, Application $application)
    {
        if (!$application->canBeReviewed()) {
            return response()->json([
                'message' => 'This application cannot be rejected in its current status.',
            ], 422);
        }

        $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $application->update([
            'status'           => 'rejected',
            'rejection_reason' => $request->reason,
            'reviewed_by'      => $request->user()->id,
            'reviewed_at'      => now(),
        ]);

        AuditLog::record('application.rejected', $application, [
            'application_no' => $application->application_no,
            'reason'         => $request->reason,
        ]);

        return response()->json([
            'message'     => 'Application rejected.',
            'application' => $application->fresh(),
        ]);
    }

    // ── College admin: return for correction ──────────────────
    // POST /api/applications/{application}/return
    public function returnForCorrection(Request $request, Application $application)
    {
        abort_if($application->college_id !== app('current_college')->id, 404);

        $request->validate(['note' => 'required|string|max:1000']);

        if (!in_array($application->status, ['submitted', 'under_review', 'shortlisted'])) {
            return response()->json([
                'message' => 'Only submitted or in-review applications can be returned.',
            ], 422);
        }

        $application->update([
            'status'          => 'returned',
            'correction_note' => $request->note,
            'reviewed_by'     => $request->user()->id,
            'reviewed_at'     => now(),
        ]);

        return response()->json([
            'message'     => 'Application returned to the applicant for correction.',
            'application' => $application->fresh(),
        ]);
    }

    // ── Student: resubmit after correction ────────────────────
    // POST /api/applications/{application}/resubmit
    public function resubmit(Request $request, Application $application)
    {
        $student = $request->user();
        abort_if($application->student_id !== $student->id, 403, 'This is not your application.');

        if ($application->status !== 'returned') {
            return response()->json([
                'message' => 'Only returned applications can be resubmitted.',
            ], 422);
        }

        $college  = app('current_college');
        $profiles = app(ApplicantProfileService::class);
        $program  = $application->program;
        $programLevels = array_values(array_filter(array_map('trim', explode(',', (string) $program->required_education_levels))));

        if ($profiles->requiresCompleteProfile($college->id)) {
            $completeness = $profiles->completeness($student, $college->id, $programLevels);
            if (!$completeness['complete']) {
                return response()->json([
                    'message'      => 'Please complete your admission profile before resubmitting.',
                    'completeness' => $completeness,
                ], 422);
            }
        }

        $application->update([
            'status'           => 'submitted',
            'profile_snapshot' => $profiles->snapshot($student),
            'submitted_at'     => now(),
        ]);

        return response()->json([
            'message'     => 'Application resubmitted successfully.',
            'application' => $application->fresh()->load('program'),
        ]);
    }

    // ── Student: withdraw their own application ───────────────────
    // POST /api/applications/{application}/withdraw
    public function withdraw(Request $request, Application $application)
    {
        // Students can only withdraw their own applications
        if ((int) $application->student_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!in_array($application->status, ['draft', 'submitted'])) {
            return response()->json([
                'message' => 'Application can only be withdrawn before review starts.',
            ], 422);
        }

        $application->update(['status' => 'withdrawn']);

        return response()->json(['message' => 'Application withdrawn.']);
    }

    // ── College admin: secure document download ───────────────────
    // GET /api/documents/{document}/download
    public function downloadDocument(Request $request, Document $document)
    {
        // Verify the document belongs to this college (BelongsToTenant
        // global scope already ensures this, but double-check for safety)
        $path = $document->stored_path;

        if (!Storage::disk('private')->exists($path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return Storage::disk('private')->download(
            $path,
            $document->original_name
        );
    }

    private function multipleAdmissionsAllowed(int $collegeId): bool
    {
        $platform = \DB::table('settings')
            ->whereNull('college_id')
            ->where('key', 'multiple_admissions_policy')
            ->value('value') ?? 'college_choice';

        if ($platform === 'allow') return true;
        if ($platform === 'deny')  return false;

        // college_choice → the college's own setting decides (default: deny)
        return \DB::table('settings')
            ->where('college_id', $collegeId)
            ->where('key', 'allow_multiple_admissions')
            ->value('value') === 'true';
    }
}