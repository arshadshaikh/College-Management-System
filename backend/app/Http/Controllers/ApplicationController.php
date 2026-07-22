<?php

namespace App\Http\Controllers;

use App\Models\Application;
use App\Models\Document;
use App\Models\Program;
use App\Models\AuditLog;
use App\Services\ChallanService;
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
            'program_id'    => 'required|exists:programs,id',
            'semester_no'   => 'required|integer|min:1',
            'admission_year'=> 'required|integer|min:2020|max:2099',

            // Required documents
            'doc_cnic'      => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'doc_matric'    => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'doc_inter'     => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'doc_photo'     => 'required|file|mimes:jpg,jpeg,png|max:1024',
        ]);

        $college = app('current_college');
        $student = $request->user();

        // Ensure program belongs to this college (BelongsToTenant already scopes,
        // but explicit check gives a clearer error message)
        $program = Program::findOrFail($request->program_id);

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

        // Check seat availability
        if ($program->availableSeats() === 0) {
            return response()->json([
                'message' => 'No seats available for this program.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            // 1. Create application
            $application = Application::create([
                'college_id'     => $college->id,
                'student_id'     => $student->id,
                'program_id'     => $program->id,
                'semester_no'    => $request->semester_no,
                'admission_year' => $request->admission_year,
                'status'         => 'submitted', // direct submit, no draft step via API
            ]);

            // 2. Upload and store documents
            $documents = [
                'doc_cnic'   => 'cnic',
                'doc_matric' => 'matric_certificate',
                'doc_inter'  => 'inter_certificate',
                'doc_photo'  => 'photo',
            ];

            foreach ($documents as $field => $type) {
                $file = $request->file($field);
                $path = $file->store(
                    "colleges/{$college->id}/docs/{$application->id}",
                    'private'  // stored in storage/app/private — not web-accessible
                );

                Document::create([
                    'college_id'          => $college->id,
                    'application_id'      => $application->id,
                    'student_id'          => $student->id,
                    'document_type'       => $type,
                    'original_name'       => $file->getClientOriginalName(),
                    'stored_path'         => $path,
                    'mime_type'           => $file->getMimeType(),
                    'file_size'           => $file->getSize(),
                    'verification_status' => 'pending',
                ]);
            }

            DB::commit();

            return response()->json([
                'message'     => 'Application submitted successfully.',
                'application' => $application->load('program', 'documents'),
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    // ── College admin: view one application ───────────────────────
    // GET /api/applications/{application}
    public function show(Application $application)
    {
        return response()->json(
            $application->load(['student.studentProfile', 'program', 'documents', 'reviewer'])
        );
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

        DB::beginTransaction();
        try {
            $application->update([
                'status'      => 'approved',
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            // Auto-generate admission challan
            $challan = $this->challanService->generateAdmission($application);

            AuditLog::record('application.approved', $application, [
                'application_no' => $application->application_no,
                'challan_no'     => $challan->challan_no,
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
}