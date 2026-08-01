<?php

namespace App\Http\Controllers;

use App\Models\College;
use App\Models\Role;
use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class CollegeAdminController extends Controller
{
    /**
     * List all college admin users (with their college).
     */
    public function index(Request $request)
    {
        $query = User::with('college', 'activeRoles')
            ->where('user_type', 'college_admin');

        if ($request->filled('college_id')) {
            $query->where('college_id', $request->college_id);
        }

        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('cnic_no', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%");
            });
        }

        $sortable = ['name', 'cnic_no', 'email', 'created_at'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'created_at';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';
        $perPage  = min(max((int) ($request->per_page ?? 15), 1), 1000);

        return response()->json($query->orderBy($sortBy, $sortDir)->paginate($perPage));

        // return response()->json($query->latest()->paginate(15));
    }

    /**
     * Create a college admin account.
     * Called by super admin from main domain.
     */
    public function store(Request $request)
    {
        $request->validate([
            'college_id' => 'required|exists:colleges,id',
            'name'       => 'required|string|max:255',
            'cnic_no'    => 'required|string|size:13|unique:users,cnic_no',
            'email'      => 'nullable|email|max:255|unique:users,email',
            'phone'      => 'nullable|string|max:20',
            'password'   => [
                'required', 'string',
                Password::min(8)->mixedCase()->numbers(),
            ],
        ]);

        $college = College::findOrFail($request->college_id);

        if (!$college->isApproved()) {
            return response()->json([
                'message' => 'Cannot create admin for a college that is not approved.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            // 1. Create the user
            $user = User::create([
                'name'       => $request->name,
                'cnic_no'    => $request->cnic_no,
                'email'      => $request->email,
                'phone'      => $request->phone,
                'password'   => $request->password,
                'college_id' => $college->id,
                'user_type'  => 'college_admin',
                'is_active'  => true,
            ]);

            // 2. Find or create the college_admin role for this college
            // $role = Role::firstOrCreate(
            //     ['slug' => 'college_admin', 'college_id' => $college->id],
            //     [
            //         'name'      => 'College Admin',
            //         'is_active' => true,
            //         'scope'     => 'college',
            //     ]
            // );

            // 2. Find or create the college_admin role for this college
            $role = Role::where('slug', 'college_admin')
                ->where('college_id', $college->id)
                ->where('is_active', true)
                ->first();
            
            // if (!$role) {
            //     $role = Role::create([
            //         'name'       => 'College Admin',
            //         'slug'       => 'college_admin',
            //         'college_id' => $college->id,
            //         'is_active'  => true,
            //         'scope'      => 'college',
            //     ]);
            // }

            AuditLog::record('college_admin.created', $user, [
                'cnic_no'    => $user->cnic_no,
                'college_id' => $college->id,
            ]);

            if (!$role) {
                return response()->json([
                    'message' => 'This college has no college_admin role. It may not have been initialized correctly on approval. Please contact platform support.',
                ], 422);
            }

            // 3. Assign role and set as active
            $user->roles()->attach($role->id, [
                'is_active'  => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $user->update(['active_role_id' => $role->id]);

            DB::commit();

            return response()->json(
                $user->load('college', 'activeRole', 'activeRoles'),
                201
            );
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Update college admin details.
     */
    public function update(Request $request, User $user)
    {
        if ($user->user_type !== 'college_admin') {
            return response()->json(['message' => 'User is not a college admin.'], 422);
        }

        $request->validate([
            'name'      => 'sometimes|string|max:255',
            'email'     => 'nullable|email|max:255|unique:users,email,' . $user->id,
            'phone'     => 'nullable|string|max:20',
            'is_active' => 'boolean',
            'password'  => [
                'nullable', 'string',
                Password::min(8)->mixedCase()->numbers(),
            ],
        ]);

        $data = $request->only(['name', 'email', 'phone', 'is_active']);

        if ($request->filled('password')) {
            $data['password'] = $request->password;
        }

        $user->update($data);

        return response()->json($user->load('college', 'activeRoles'));
    }

    // PATCH /api/college-admins/{user}/toggle-active
    public function toggleActive(Request $request, User $user)
    {
        if ($user->user_type !== 'college_admin') {
            return response()->json(['message' => 'Not a college admin.'], 404);
        }

        $user->update(['is_active' => !$user->is_active]);

        AuditLog::record($user->is_active ? 'college_admin.reactivated' : 'college_admin.deactivated', $user, [
            'cnic_no' => $user->cnic_no,
        ]);

        return response()->json([
            'message' => $user->is_active ? 'Admin reactivated.' : 'Admin deactivated.',
            'user'    => $user->fresh(),
        ]);
    }
}