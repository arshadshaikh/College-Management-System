<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('activeRoles');

        // Tenant scope: super admin sees all; everyone else only their own college.
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            $query->where('college_id', $user->college_id);
        }

        if ($request->has('search')) {
            $search = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('cnic_no', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return response()->json($query->latest()->paginate(15));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'cnic_no' => 'required|string|size:13|unique:users,cnic_no',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'password' => ['required', 'string', 'min:8', \Illuminate\Validation\Rules\Password::min(8)->mixedCase()->numbers()],
            'is_active' => 'boolean',
        ]);

        $user = User::create($request->only(['name', 'cnic_no', 'email', 'phone', 'password', 'is_active']));

        return response()->json($user->load('activeRoles'), 201);
    }

    public function show(User $user)
    {
        return response()->json($user->load('activeRoles'));
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'cnic_no' => 'sometimes|string|size:13|unique:users,cnic_no,' . $user->id,
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'password' => ['nullable', 'string', 'min:8', \Illuminate\Validation\Rules\Password::min(8)->mixedCase()->numbers()],
            'is_active' => 'boolean',
        ]);

        $data = $request->only(['name', 'cnic_no', 'email', 'phone', 'is_active']);
        if ($request->filled('password')) {
            $data['password'] = $request->password;
        }

        $user->update($data);

        return response()->json($user->load('activeRoles'));
    }

    public function assignRoles(Request $request, User $user)
    {
        $request->validate([
            'role_ids' => 'required|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        $newRoleIds = collect($request->role_ids);
        $existingRoles = $user->roles()->pluck('roles.id');

        // Deactivate roles not in the new list
        $toDeactivate = $existingRoles->diff($newRoleIds);
        if ($toDeactivate->isNotEmpty()) {
            $user->roles()->updateExistingPivot($toDeactivate->toArray(), [
                'is_active' => false,
                'updated_at' => now(),
            ]);
        }

        // Activate or attach roles in the new list
        foreach ($newRoleIds as $roleId) {
            if ($existingRoles->contains($roleId)) {
                $user->roles()->updateExistingPivot($roleId, [
                    'is_active' => true,
                    'updated_at' => now(),
                ]);
            } else {
                $user->roles()->attach($roleId, [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        return response()->json($user->load('activeRoles'));
    }
}
