<?php

namespace App\Http\Controllers;

use App\Models\College;
use App\Models\CollegeDocument;
use App\Models\AuditLog;
use App\Services\CollegeInitializationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;


class CollegeController extends Controller
{
    public function __construct(
        private CollegeInitializationService $initializer
    ) {}

    // ── Public: college self-registration ─────────────────────────
    // POST /api/colleges/register  (no auth required)
    public function register(Request $request)
    {
        $request->validate([
            'name'     => 'required|string|max:255',
            'slug'     => [
                'required',
                'string',
                'max:30',
                'alpha_dash',          // only letters, numbers, dashes, underscores
                'unique:colleges,slug',
                'not_in:www,api,admin,mail,ftp,localhost,app',
            ],
            'email'    => 'required|email|max:255|unique:colleges,email',
            'phone'    => 'nullable|string|max:20',
            'address'  => 'nullable|string|max:500',
            'city'     => 'nullable|string|max:100',
            'province' => 'nullable|string|max:100',
        ]);

        // Pull the required document config and validate uploads against it.
        // $types = \App\Models\RequiredDocumentType::where('scope', 'college_registration')
        //   ->where('is_active', true)->get();
        
        $types = \App\Models\RequiredDocumentType::where('scope', 'college_registration')
            ->where('is_active', true)->get();

        $rules = [];
        foreach ($types as $t) {
            $field = "doc_{$t->slug}";
            // $rules[$field] = ($t->is_mandatory ? 'required' : 'nullable')
            //    . '|file|mimes:jpg,jpeg,png,pdf|max:4096';

            $parts = [$t->is_mandatory ? 'required' : 'nullable', 'file'];

            // Real MIME-type validation (content-based, not extension).
            if ($t->allowed_mime_types) {
                $parts[] = 'mimetypes:' . $t->allowed_mime_types;   // content-based MIME check
            }

            // Max file size (validator wants KB).
            $parts[] = 'max:' . ($t->max_size_kb ?: 4096);

            // Max image dimensions — only when set. Laravel's `dimensions` rule
            // is skipped automatically for non-images, so it's safe on pdf-allowed types.
            if ($t->max_dimension) {
                $parts[] = "dimensions:max_width={$t->max_dimension},max_height={$t->max_dimension}";
            }

            $rules[$field] = implode('|', $parts);

        }
        $request->validate($rules);

        $college = DB::transaction(function () use ($request, $types) {

            $college = College::create([
                'name'=>$request->name,'slug'=>$request->slug,'email'=>$request->email,
                'phone'=>$request->phone,'city'=>$request->city,'province'=>$request->province,
                'address'  => $request->address, 'status'=>'pending',
            ]);

            foreach ($types as $t) {
                $field = "doc_{$t->slug}";
                if ($request->hasFile($field)) {
                    $path = $request->file($field)->store("colleges/{$college->id}/registration", 'private');
                    \App\Models\CollegeDocument::create([
                        'college_id'=>$college->id,'document_slug'=>$t->slug,'document_name'=>$t->name,
                        'original_name'=>$request->file($field)->getClientOriginalName(),
                        'stored_path'=>$path,'mime_type'=>$request->file($field)->getMimeType(),
                        'file_size'=>$request->file($field)->getSize(),
                    ]);
                }
            }

            return $college;
        });

        // $college = College::create([
        //     'name'     => $request->name,
        //     'slug'     => Str::lower($request->slug),
        //     'email'    => $request->email,
        //     'phone'    => $request->phone,
        //     'address'  => $request->address,
        //     'city'     => $request->city,
        //     'province' => $request->province,
        //     'status'   => 'pending',
        // ]);

        return response()->json([
            'message' => 'Registration submitted. You will be notified once approved.',
            'college' => $college,
        ], 201);
        
    }

    // ── Super admin: list colleges with filters ───────────────────
    // GET /api/colleges
    public function index(Request $request)
    {
        $query = College::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('slug', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
                  ->orWhere('city', 'like', "%{$s}%");
            });
        }

        $sortable = ['name', 'slug', 'city', 'status', 'created_at'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'created_at';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';

        $perPage = min(max((int) ($request->per_page ?? 15), 1), 1000);

        return response()->json($query->orderBy($sortBy, $sortDir)->paginate($perPage));
    }

    // ── Super admin: view single college ──────────────────────────
    public function show(College $college)
    {
        // return response()->json($college->load('users'));
        return response()->json($college->load('documents', 'users'));
    }

    // ── Super admin: approve a college ────────────────────────────
    // POST /api/colleges/{college}/approve
    public function approve(Request $request, College $college)
    {
        if ($college->status === 'approved') {
            return response()->json(['message' => 'College is already approved.'], 422);
        }

        $from = $college->status;

        DB::beginTransaction();
        try {
            $college->update([
                'status'      => 'approved',
                'approved_at' => now(),
                'approved_by' => $request->user()->id,
                'rejection_reason' => null,
            ]);

            // Auto-initialize CMS, roles, and settings
            $this->initializer->initialize($college);

            //AuditLog::record('college.approved', $college, ['slug' => $college->slug]);
            AuditLog::record('college.approved', $college, ['from' => $from, 'to' => 'approved', 'slug' => $college->slug]);

            \Illuminate\Support\Facades\Cache::forget("tenant:{$college->slug}");

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'message' => "College '{$college->name}' approved and initialized successfully.",
            'college' => $college->fresh(),
        ]);
    }

    // ── Super admin: reject a college ─────────────────────────────
    // POST /api/colleges/{college}/reject
    public function reject(Request $request, College $college)
    {
        if ($college->status === 'approved') {
            return response()->json(['message' => 'Cannot reject an already approved college.'], 422);
        }

        $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $from = $college->status;

        $college->update([
            'status'           => 'rejected',
            'rejection_reason' => $request->reason,
        ]);

        // AuditLog::record('college.suspended', $college, ['reason' => $request->reason]);
        AuditLog::record('college.rejected', $college, ['from' => $from, 'to' => 'rejected', 'reason' => $request->reason]);

        return response()->json([
            'message' => "College '{$college->name}' has been rejected.",
            'college' => $college->fresh(),
        ]);
    }

    // ── Super admin: suspend an approved college ──────────────────
    // POST /api/colleges/{college}/suspend
    public function suspend(Request $request, College $college)
    {
        if ($college->status !== 'approved') {
            return response()->json(['message' => 'Only approved colleges can be suspended.'], 422);
        }

        $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $from = $college->status;

        $college->update([
            'status'           => 'suspended',
            'rejection_reason' => $request->reason,
        ]);

        // AuditLog::record('college.suspended', $college, ['reason' => $request->reason]);
        AuditLog::record('college.suspended', $college, ['from' => $from, 'to' => 'suspended', 'reason' => $request->reason]);

        // Clear the tenant cache so the subdomain stops resolving immediately
        \Illuminate\Support\Facades\Cache::forget("tenant:{$college->slug}");

        return response()->json([
            'message' => "College '{$college->name}' has been suspended.",
            'college' => $college->fresh(),
        ]);
    }

    // ── Super admin: update college details ───────────────────────
    public function update(Request $request, College $college)
    {
        $request->validate([
            'name'     => 'sometimes|string|max:255',
            'email'    => 'sometimes|email|max:255|unique:colleges,email,' . $college->id,
            'phone'    => 'nullable|string|max:20',
            'address'  => 'nullable|string|max:500',
            'city'     => 'nullable|string|max:100',
            'province' => 'nullable|string|max:100',
        ]);

        $college->update($request->only([
            'name', 'email', 'phone', 'address', 'city', 'province',
        ]));

        // Bust cache in case name/details changed
        \Illuminate\Support\Facades\Cache::forget("tenant:{$college->slug}");

        return response()->json($college->fresh());
    }

    // ── Super admin: reinstate a suspended college ────────────────
    // POST /api/colleges/{college}/reinstate
    public function reinstate(Request $request, College $college)
    {
        if ($college->status !== 'suspended') {
            return response()->json(['message' => 'Only suspended colleges can be reinstated.'], 422);
        }

        $from = $college->status;

        // Flip status back only. Roles/pages/settings already exist from the
        // original approval — do NOT re-initialize, and preserve approved_at.
        $college->update([
            'status'           => 'approved',
            'rejection_reason' => null,
        ]);

        // AuditLog::record('college.reinstated', $college, ['slug' => $college->slug]);
        AuditLog::record('college.reinstated', $college, ['from' => $from, 'to' => 'approved']);

        // Subdomain must resolve again immediately.
        \Illuminate\Support\Facades\Cache::forget("tenant:{$college->slug}");

        return response()->json([
            'message' => "College '{$college->name}' has been reinstated.",
            'college' => $college->fresh(),
        ]);
    }

    // GET /api/college-documents/{collegeDocument}/download — super admin only
    public function downloadDocument(CollegeDocument $collegeDocument)
    {
        if (!Storage::disk('private')->exists($collegeDocument->stored_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return Storage::disk('private')->download(
            $collegeDocument->stored_path,
            $collegeDocument->original_name
        );
    }

    // GET /api/public/colleges — approved colleges for the platform directory (no auth, main domain)
    public function publicIndex(Request $request)
    {
        // $query = College::where('status', 'approved');
        $query = College::where('status', 'approved')->where('is_platform', false);

        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where('name', 'like', "%{$s}%");
        }

        return response()->json(
            $query->orderBy('name')->get(['id', 'name', 'slug', 'city', 'province'])
        );
    }
}