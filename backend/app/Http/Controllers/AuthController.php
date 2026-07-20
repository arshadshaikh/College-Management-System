<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'cnic_no' => 'required|string|size:13',
            'password' => 'required|string',
        ]);

        // Tenant context resolved by ResolveTenant (global API middleware).
        // Bound only when a valid subdomain mapped to an approved college.
        $college = app()->bound('current_college') ? app('current_college') : null;

        $user = User::where('cnic_no', $request->cnic_no)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid CNIC or password'], 401);
        }

        // ── Tenant-aware gating (Lesson #10) ───────────────────────────────
        // Super admins may log in from any context. Everyone else is pinned
        // to their own college. Generic message everywhere → no cross-tenant
        // account enumeration.
        if (!$user->isSuperAdmin()) {
            if ($college) {
                // On a college subdomain: user must belong to THIS college.
                if ((int) $user->college_id !== (int) $college->id) {
                    return response()->json(['message' => 'Invalid CNIC or password'], 401);
                }
            } else {
                // On the main domain: only super admins allowed (handled by the
                // outer !isSuperAdmin guard — a non-super-admin here is rejected).
                return response()->json(['message' => 'Invalid CNIC or password'], 401);
            }
        }
        // ───────────────────────────────────────────────────────────────────

        if (!$user->is_active) {
            return response()->json(['message' => 'Account is deactivated'], 403);
        }

        // Auto-set active role if not set or invalid
        $activeRoleIds = $user->activeRoles()->pluck('roles.id');
        if (!$user->active_role_id || !$activeRoleIds->contains($user->active_role_id)) {
            $user->update(['active_role_id' => $activeRoleIds->first()]);
        }

        $token = JWTAuth::fromUser($user);

        return response()->json([
            'access_token' => $token,
            'token_type'   => 'bearer',
            'expires_in'   => config('jwt.ttl') * 60,
            'user'         => $user->load('activeRole', 'activeRoles', 'college'),
            'college'      => $user->college,
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        // $user->load('activeRole', 'activeRoles');
        $user->load('activeRole', 'activeRoles', 'college');

        return response()->json([
            'user' => $user,
            'menu' => $user->getMenuItems(),
            'privileges' => $user->getAllPrivileges()->pluck('slug'),
            'college'    => $user->college,
        ]);
    }

    public function logout()
    {
        JWTAuth::invalidate(JWTAuth::getToken());

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function refresh()
    {
        $token = JWTAuth::refresh(JWTAuth::getToken());

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => config('jwt.ttl') * 60,
        ]);
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => ['required', 'string', 'min:8', 'confirmed', \Illuminate\Validation\Rules\Password::min(8)->mixedCase()->numbers()],
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 422);
        }

        $user->update(['password' => $request->password]);

        // Invalidate current token so user must re-login
        JWTAuth::invalidate(JWTAuth::getToken());

        return response()->json(['message' => 'Password changed successfully']);
    }

    public function changeRole(Request $request)
    {
        $request->validate([
            'role_id' => 'required|exists:roles,id',
        ]);

        $user = $request->user();
        $role    = \App\Models\Role::find($request->role_id);

        // ── Tenant-scope enforcement ──────────────────────────────
        // A college-scoped role must belong to the user's college.
        // Super admins can switch to any platform-scoped role freely.
        if (!$user->isSuperAdmin()) {
            if ($role->college_id && (int) $role->college_id !== (int) $user->college_id) {
                return response()->json([
                    'message' => 'This role does not belong to your college.',
                ], 403);
            }
        }

        // Verify user has this role assigned and active
        $hasRole = $user->activeRoles()
            ->where('roles.id', $request->role_id)
            ->where('roles.is_active', true)
            ->exists();

        if (!$hasRole) {
            return response()->json(['message' => 'You do not have access to this role.'], 403);
        }

        $user->update(['active_role_id' => $request->role_id]);
        // $user->load('activeRole', 'activeRoles');
        $user->load('activeRole', 'activeRoles', 'college');

        return response()->json([
            'message' => 'Role switched successfully',
            'user' => $user,
            'menu' => $user->getMenuItems(),
            'privileges' => $user->getAllPrivileges()->pluck('slug'),
        ]);
    }

    public function register(Request $request)
    {
        // Self-registration is only valid on a college subdomain.
        // No tenant context → main domain → reject (mirror of the login guard).
        $college = app()->bound('current_college') ? app('current_college') : null;
        if (!$college) {
            return response()->json([
                'message' => 'Student registration is only available on a college portal.',
            ], 422);
        }

        $request->validate([
            'name'           => 'required|string|max:255',
            'cnic_no'        => 'required|string|size:13|unique:users,cnic_no',
            'email'          => 'nullable|email|max:255',
            'phone'          => 'nullable|string|max:20',
            'password'       => ['required', 'string', 'confirmed',
                                \Illuminate\Validation\Rules\Password::min(8)->mixedCase()->numbers()],
            'father_name'    => 'required|string|max:255',
            'gender'         => 'nullable|in:male,female,other',
            'date_of_birth'  => 'nullable|date|before:today',
        ]);

        // The per-tenant student role MUST exist (seeded by CollegeInitializationService
        // on approval). Fetch by slug AND college_id — never slug alone (Lesson #2),
        // or we risk grabbing another college's role or an orphan.
        $studentRole = \App\Models\Role::where('slug', 'student')
            ->where('college_id', $college->id)
            ->where('is_active', true)
            ->first();

        if (!$studentRole) {
            // Fail loudly — a student with no role can log in but do nothing.
            return response()->json([
                'message' => 'Registration is temporarily unavailable for this college. Please contact the administration.',
            ], 503);
        }

        $user = \Illuminate\Support\Facades\DB::transaction(function () use ($request, $college, $studentRole) {
            // 1. Create the user, pinned to this tenant.
            $user = User::create([
                'name'       => $request->name,
                'cnic_no'    => $request->cnic_no,
                'email'      => $request->email,
                'phone'      => $request->phone,
                'password'   => $request->password, // hashed by the model's 'password' => 'hashed' cast
                'is_active'  => true,
                'college_id' => $college->id,
                'user_type'  => 'student',
            ]);

            // 2. Create the student profile (father_name is the only required extra field).
            $user->studentProfile()->create([
                'college_id'  => $college->id,
                'father_name' => $request->father_name,
                'gender'        => $request->gender,
                'date_of_birth' => $request->date_of_birth,
            ]);

            // 3. Attach the per-tenant student role and make it active.
            $user->roles()->attach($studentRole->id);
            $user->update(['active_role_id' => $studentRole->id]);

            return $user;
        });

        // 4. Issue a JWT so the student is logged in immediately after registering.
        $token = JWTAuth::fromUser($user);

        return response()->json([
            'access_token' => $token,
            'token_type'   => 'bearer',
            'expires_in'   => config('jwt.ttl') * 60,
            'user'         => $user->load('activeRole', 'activeRoles', 'college', 'studentProfile'),
            'college'      => $user->college,
        ], 201);
    }
}
