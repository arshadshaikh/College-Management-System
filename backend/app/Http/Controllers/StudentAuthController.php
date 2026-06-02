<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

class StudentAuthController extends Controller
{
    /**
     * Student self-registration.
     * Requires: tenant middleware (college subdomain).
     * Does NOT require auth.
     */
    public function register(Request $request)
    {
        // ResolveTenant middleware already ran — college is guaranteed here
        $college = app('current_college');

        $request->validate([
            // Account credentials
            'name'        => 'required|string|max:255',
            'cnic_no'     => 'required|string|size:13|unique:users,cnic_no',
            'email'       => 'nullable|email|max:255|unique:users,email',
            'phone'       => 'nullable|string|max:20',
            'password'    => [
                'required', 'confirmed',
                Password::min(8)->mixedCase()->numbers(),
            ],
            // Basic profile (collected at registration)
            'father_name' => 'required|string|max:255',
            'gender'      => 'required|in:male,female,other',
            'date_of_birth' => 'required|date|before:today',
        ]);

        DB::beginTransaction();
        try {
            // 1. Find or create the student role for this college
            // $role = Role::firstOrCreate(
            //     ['slug' => 'student', 'college_id' => $college->id],
            //     [
            //         'name'      => 'Student',
            //         'is_active' => true,
            //         'scope'     => 'student',
            //     ]
            // );

            // Find the student role that was seeded for this college on approval
            $role = Role::where('slug', 'student')
                ->where('college_id', $college->id)
                ->first();
            
            if (!$role) {
                $role = Role::create([
                    'name'       => 'Student',
                    'slug'       => 'student',
                    'college_id' => $college->id,
                    'is_active'  => true,
                    'scope'      => 'student',
                ]);

                // Assign standard student privileges to this new role
                $studentPrivileges = \App\Models\Privilege::whereIn('slug', [
                    'programs.index', 'programs.show',
                    'applications.my', 'applications.store', 'applications.withdraw',
                    'challans.my', 'challans.upload-slip', 'challans.pdf',
                ])->pluck('id');

                foreach ($studentPrivileges as $privId) {
                    \Illuminate\Support\Facades\DB::table('privilege_role')->insert([
                        'role_id'      => $role->id,
                        'privilege_id' => $privId,
                        'created_at'   => now(),
                    ]);
                }
            }

            // 2. Create the user account
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

            // 3. Assign the student role
            $user->roles()->attach($role->id, [
                'is_active'  => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $user->update(['active_role_id' => $role->id]);

            // 4. Create the student profile
            StudentProfile::create([
                'user_id'       => $user->id,
                'college_id'    => $college->id,
                'father_name'   => $request->father_name,
                'gender'        => $request->gender,
                'date_of_birth' => $request->date_of_birth,
            ]);

            // 5. Issue JWT immediately (no separate login step needed)
            $token = JWTAuth::fromUser($user);

            DB::commit();

            return response()->json([
                'message'      => 'Registration successful.',
                'access_token' => $token,
                'token_type'   => 'bearer',
                'expires_in'   => config('jwt.ttl') * 60,
                'user'         => $user->load('activeRole', 'college', 'studentProfile'),
                'college'      => $college,
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }
}