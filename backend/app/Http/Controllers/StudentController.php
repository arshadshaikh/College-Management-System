<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use App\Models\StudentProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;

class StudentController extends Controller
{
    // GET /api/students — list this college's students
    public function index(Request $request)
    {
        $college = app('current_college');

        $query = User::where('college_id', $college->id)
            ->where('user_type', 'student')
            ->with('studentProfile')
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('cnic_no', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%");
            });
        }

        return response()->json($query->paginate(min((int) $request->input('per_page', 20), 100)));
    }

    // POST /api/students — admin creates a student
    public function store(Request $request)
    {
        $college = app('current_college');

        $request->validate([
            'name'          => 'required|string|max:255',
            'cnic_no'       => 'required|string|size:13|unique:users,cnic_no',
            'email'         => 'nullable|email|max:255|unique:users,email',
            'phone'         => 'nullable|string|max:20',
            'password'      => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'father_name'   => 'required|string|max:255',
            'gender'        => 'required|in:male,female,other',
            'date_of_birth' => 'required|date|before:today',
        ]);

        $role = Role::where('slug', 'student')->where('college_id', $college->id)->first();
        if (!$role) {
            return response()->json(['message' => 'Student role not found for this college.'], 422);
        }

        DB::beginTransaction();
        try {
            $user = User::create([
                'name'       => $request->name,
                'cnic_no'    => $request->cnic_no,
                'email'      => $request->email,
                'phone'      => $request->phone,
                'password'   => $request->password,
                'college_id' => $college->id,
                'user_type'  => 'student',
                'is_active'  => true,
            ]);

            $user->roles()->attach($role->id, ['is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
            $user->update(['active_role_id' => $role->id]);

            StudentProfile::create([
                'user_id'       => $user->id,
                'college_id'    => $college->id,
                'father_name'   => $request->father_name,
                'gender'        => $request->gender,
                'date_of_birth' => $request->date_of_birth,
            ]);

            DB::commit();
            return response()->json($user->load('studentProfile'), 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    // GET /api/students/{student}
    public function show(User $student)
    {
        $college = app('current_college');
        if ($student->college_id !== $college->id || $student->user_type !== 'student') {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        // return response()->json(
        //     $student->load('studentProfile', 'applications.program', 'activeRoles')
        // );

        return response()->json($student->load('studentProfile'));
    }

    // PUT /api/students/{student}
    public function update(Request $request, User $student)
    {
        $college = app('current_college');
        if ($student->college_id !== $college->id || $student->user_type !== 'student') {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $request->validate([
            'name'          => 'sometimes|string|max:255',
            'email'         => 'nullable|email|max:255|unique:users,email,' . $student->id,
            'phone'         => 'nullable|string|max:20',
            'father_name'   => 'sometimes|string|max:255',
            'gender'        => 'sometimes|in:male,female,other',
            'date_of_birth' => 'sometimes|date|before:today',
            'is_active'     => 'boolean',
            'password'      => ['nullable', 'confirmed', \Illuminate\Validation\Rules\Password::min(8)->mixedCase()->numbers()],
        ]);

        DB::beginTransaction();
        try {
            $userData = $request->only(['name', 'email', 'phone', 'is_active']);
            if ($request->filled('password')) {
                $userData['password'] = $request->password;
            }
            $student->update($userData);

            if ($student->studentProfile) {
                $student->studentProfile->update($request->only(['father_name', 'gender', 'date_of_birth']));
            }

            DB::commit();
            return response()->json($student->fresh()->load('studentProfile'));
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }
}