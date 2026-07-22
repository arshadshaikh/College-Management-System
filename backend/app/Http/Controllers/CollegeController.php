<?php

namespace App\Http\Controllers;

use App\Models\College;
use App\Models\AuditLog;
use App\Services\CollegeInitializationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

        $college = College::create([
            'name'     => $request->name,
            'slug'     => Str::lower($request->slug),
            'email'    => $request->email,
            'phone'    => $request->phone,
            'address'  => $request->address,
            'city'     => $request->city,
            'province' => $request->province,
            'status'   => 'pending',
        ]);

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
                  ->orWhere('email', 'like', "%{$s}%");
            });
        }

        return response()->json($query->latest()->paginate(15));
    }

    // ── Super admin: view single college ──────────────────────────
    public function show(College $college)
    {
        return response()->json($college->load('users'));
    }

    // ── Super admin: approve a college ────────────────────────────
    // POST /api/colleges/{college}/approve
    public function approve(Request $request, College $college)
    {
        if ($college->status === 'approved') {
            return response()->json(['message' => 'College is already approved.'], 422);
        }

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

            AuditLog::record('college.approved', $college, ['slug' => $college->slug]);

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

        $college->update([
            'status'           => 'rejected',
            'rejection_reason' => $request->reason,
        ]);

        AuditLog::record('college.suspended', $college, ['reason' => $request->reason]);

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

        $college->update([
            'status'           => 'suspended',
            'rejection_reason' => $request->reason,
        ]);

        AuditLog::record('college.suspended', $college, ['reason' => $request->reason]);

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
}