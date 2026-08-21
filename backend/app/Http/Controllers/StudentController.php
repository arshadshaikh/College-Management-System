<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use App\Models\StudentProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use App\Imports\StudentsImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Validator;

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
        return response()->json(
            $student->load('studentProfile', 'applications.program', 'activeRoles')
        );

        // return response()->json($student->load('studentProfile'));
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

    // GET /api/students/import/template — download the Excel template
    public function importTemplate()
    {
        $headers = ['name', 'cnic_no', 'email', 'phone', 'father_name', 'gender', 'date_of_birth', 'password'];
        $example = ['Ali Khan', '4210112345671', 'ali@example.com', '03001234567', 'Khan Sahib', 'male', '2003-04-15', 'Passw0rd1'];

        $callback = function () use ($headers, $example) {
            $out = fopen('php://output', 'w');
            fputcsv($out, $headers);
            fputcsv($out, $example);
            fclose($out);
        };

        return response()->streamDownload($callback, 'students_template.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }

    // POST /api/students/import — upload + create (partial success)
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:5120',
        ]);

        $college = app('current_college');
        $role = Role::where('slug', 'student')->where('college_id', $college->id)->first();
        if (!$role) {
            return response()->json(['message' => 'Student role not found for this college.'], 422);
        }

        $import = new StudentsImport();
        Excel::import($import, $request->file('file'));
        $rows = $import->rows ?? collect();

        $created = 0;
        $errors = [];

        foreach ($rows as $i => $row) {
            $rowNum = $i + 2; // +1 for heading row, +1 for 1-based
            $data = [
                'name'          => trim((string) ($row['name'] ?? '')),
                'cnic_no'       => preg_replace('/\D/', '', (string) ($row['cnic_no'] ?? '')),
                'email'         => trim((string) ($row['email'] ?? '')) ?: null,
                'phone'         => trim((string) ($row['phone'] ?? '')) ?: null,
                'father_name'   => trim((string) ($row['father_name'] ?? '')),
                'gender'        => strtolower(trim((string) ($row['gender'] ?? ''))),
                'date_of_birth' => $this->normalizeDate($row['date_of_birth'] ?? null),
                'password'      => (string) ($row['password'] ?? ''),
            ];

            // Skip completely empty rows
            if ($data['name'] === '' && $data['cnic_no'] === '') {
                continue;
            }

            $validator = Validator::make($data, [
                'name'          => 'required|string|max:255',
                'cnic_no'       => 'required|string|size:13|unique:users,cnic_no',
                'email'         => 'nullable|email|max:255|unique:users,email',
                'phone'         => 'nullable|string|max:20',
                'father_name'   => 'required|string|max:255',
                'gender'        => 'required|in:male,female,other',
                'date_of_birth' => 'required|date|before:today',
                'password'      => ['required', \Illuminate\Validation\Rules\Password::min(8)->mixedCase()->numbers()],
            ]);

            if ($validator->fails()) {
                $errors[] = ['row' => $rowNum, 'message' => implode(' ', $validator->errors()->all())];
                continue;
            }

            try {
                DB::beginTransaction();
                $user = User::create([
                    'name'       => $data['name'],
                    'cnic_no'    => $data['cnic_no'],
                    'email'      => $data['email'],
                    'phone'      => $data['phone'],
                    'password'   => $data['password'],
                    'college_id' => $college->id,
                    'user_type'  => 'student',
                    'is_active'  => true,
                ]);
                $user->roles()->attach($role->id, ['is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
                $user->update(['active_role_id' => $role->id]);
                StudentProfile::create([
                    'user_id'       => $user->id,
                    'college_id'    => $college->id,
                    'father_name'   => $data['father_name'],
                    'gender'        => $data['gender'],
                    'date_of_birth' => $data['date_of_birth'],
                ]);
                DB::commit();
                $created++;
            } catch (\Throwable $e) {
                DB::rollBack();
                $errors[] = ['row' => $rowNum, 'message' => 'Could not create: ' . $e->getMessage()];
            }
        }

        return response()->json([
            'created' => $created,
            'skipped' => count($errors),
            'errors'  => $errors,
        ]);
    }

    // Handle both Excel date serials and string dates
    private function normalizeDate($value): ?string
    {
        if ($value === null || $value === '') return null;
        // Excel numeric date serial
        if (is_numeric($value)) {
            try {
                return \Carbon\Carbon::instance(
                    \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $value)
                )->format('Y-m-d');
            } catch (\Throwable $e) { return (string) $value; }
        }
        try {
            return \Carbon\Carbon::parse((string) $value)->format('Y-m-d');
        } catch (\Throwable $e) {
            return (string) $value; // let validation reject it
        }
    }
}