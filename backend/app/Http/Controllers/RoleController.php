<?php

namespace App\Http\Controllers;

use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RoleController extends Controller
{
    // public function index()
    // {
    //     return response()->json(Role::with('privileges')->withCount('users')->latest()->get());
    // }

    public function index(Request $request)
    {
        $query = Role::with(['privileges', 'college:id,name,slug'])->withCount('users');

        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            $query->where('college_id', $user->college_id);
        }

        // return response()->json($query->latest()->get());
        // return response()->json($query->latest()->paginate(15));

        $sortable = ['name', 'code', 'degree_level', 'total_seats', 'created_at'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'created_at';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';

        return response()->json($query->orderBy($sortBy, $sortDir)->paginate(15));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:roles,slug',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $data = $request->only(['name', 'description', 'is_active']);
        $data['slug'] = $request->slug ?? Str::slug($request->name);

        $role = Role::create($data);

        return response()->json($role, 201);
    }

    public function show(Role $role)
    {
        return response()->json($role->load('privileges'));
    }

    public function update(Request $request, Role $role)
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255|unique:roles,slug,' . $role->id,
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $role->update($request->only(['name', 'slug', 'description', 'is_active']));

        return response()->json($role->load('privileges'));
    }

    public function assignPrivileges(Request $request, Role $role)
    {
        $request->validate([
            'privilege_ids' => 'required|array',
            'privilege_ids.*' => 'exists:privileges,id',
        ]);

        $role->privileges()->sync($request->privilege_ids);

        return response()->json($role->load('privileges'));
    }
}
