<?php

namespace App\Http\Controllers;

use App\Services\PlanGate;
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
    // GET /api/students — list this college's students, with filters and counts.
    // "Enrolled" = has an approved application; its program, batch (admission year)
    // and shift are shown and filterable. Students created by hand or imported have
    // none until an application is approved, and show as "Not enrolled".
    public function index(Request $request)
    {
        $college = app('current_college');

        // The student's latest approved application (one row per student).
        $enrolment = fn (string $column) => DB::table('applications')
            ->whereColumn('applications.student_id', 'users.id')
            ->where('applications.status', 'approved')
            ->whereNull('applications.deleted_at')
            ->orderByDesc('applications.id')->limit(1)
            ->select($column);

        $base = User::where('users.college_id', $college->id)->where('users.user_type', 'student');

        // Search and enrolment filters apply to the counts too; the status filter does not,
        // so the Active / Inactive counts still show both sides.
        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $base->where(function ($q) use ($s) {
                $q->where('users.name', 'like', "%{$s}%")
                  ->orWhere('users.cnic_no', 'like', "%{$s}%")
                  ->orWhere('users.email', 'like', "%{$s}%");
            });
        }
        $approved = fn ($q) => $q->select(DB::raw(1))->from('applications')
            ->whereColumn('applications.student_id', 'users.id')
            ->where('applications.status', 'approved')->whereNull('applications.deleted_at');

        if ($request->input('program_id') === 'none') {
            $base->whereNotExists($approved);
        } elseif ($request->filled('program_id')) {
            $base->whereExists(fn ($q) => $approved($q)->where('applications.program_id', (int) $request->program_id));
        }
        if ($request->filled('batch')) {
            $base->whereExists(fn ($q) => $approved($q)->where('applications.admission_year', (int) $request->batch));
        }
        if ($request->filled('shift')) {
            $base->whereExists(fn ($q) => $approved($q)->where('applications.shift', $request->shift));
        }

        $summary = [
            'total'    => (clone $base)->count(),
            'active'   => (clone $base)->where('users.is_active', true)->count(),
            'inactive' => (clone $base)->where('users.is_active', false)->count(),
            'enrolled' => (clone $base)->whereExists($approved)->count(),
        ];
        $summary['not_enrolled'] = $summary['total'] - $summary['enrolled'];

        $query = (clone $base)
            ->select('users.*')
            ->addSelect([
                'program_name' => $enrolment('programs.name')->join('programs', 'programs.id', '=', 'applications.program_id'),
                'batch'        => $enrolment('applications.admission_year'),
                'shift'        => $enrolment('applications.shift'),
            ])
            ->with('studentProfile');

        if ($request->input('status') === 'active') {
            $query->where('users.is_active', true);
        } elseif ($request->input('status') === 'inactive') {
            $query->where('users.is_active', false);
        }

        $sortable = ['name' => 'users.name', 'cnic_no' => 'users.cnic_no', 'created_at' => 'users.created_at',
                     'program_name' => 'program_name', 'batch' => 'batch'];
        $sortBy = $sortable[$request->input('sort_by')] ?? null;
        $dir = $request->input('sort_dir') === 'asc' ? 'asc' : 'desc';
        $sortBy ? $query->orderBy($sortBy, $dir) : $query->orderByDesc('users.created_at');
        $query->orderByDesc('users.id');

        $page = $query->paginate(max(1, min((int) $request->input('per_page', 25), 1000)));

        // Choices for the filter menus: only values that this college's students actually have.
        $apps = DB::table('applications')
            ->join('users', 'users.id', '=', 'applications.student_id')
            ->where('applications.college_id', $college->id)
            ->where('applications.status', 'approved')->whereNull('applications.deleted_at')
            ->where('users.user_type', 'student');

        return response()->json($page->toArray() + [
            'summary' => $summary,
            'options' => [
                'programs' => DB::table('programs')->where('college_id', $college->id)->whereNull('deleted_at')
                    ->orderBy('name')->get(['id', 'name']),
                'batches'  => (clone $apps)->whereNotNull('applications.admission_year')->distinct()
                    ->orderByDesc('applications.admission_year')->pluck('applications.admission_year'),
                'shifts'   => (clone $apps)->whereNotNull('applications.shift')->distinct()
                    ->orderBy('applications.shift')->pluck('applications.shift'),
            ],
        ]);
    }

    // POST /api/students — admin creates a student
    public function store(Request $request)
    {
        $college = app('current_college');

        // Subscription: stop at the plan's student limit.
        if ($limit = PlanGate::studentLimitMessage($college->id)) {
            return response()->json(['message' => $limit, 'error' => 'student_limit'], 422);
        }

        // Say who already holds the CNIC instead of the bare "has already been taken".
        if ($taken = $this->cnicTaken((string) $request->input('cnic_no'), $college->id)) {
            return response()->json([
                'message' => $taken['message'],
                'errors'  => ['cnic_no' => [$taken['message']]],
                'existing_student_id' => $taken['student_id'],
            ], 422);
        }

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

        // Subscription: turning an inactive student back on counts against the limit.
        if ($request->boolean('is_active') && !$student->is_active
            && ($limit = PlanGate::studentLimitMessage($college->id))) {
            return response()->json(['message' => $limit, 'error' => 'student_limit', 'errors' => ['is_active' => [$limit]]], 422);
        }

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

            if ($data['cnic_no'] !== '' && ($taken = $this->cnicTaken($data['cnic_no'], app('current_college')->id))) {
                $errors[] = ['row' => $rowNum, 'message' => $taken['message']];
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

            // Subscription: rows past the plan's student limit are skipped, not created.
            if ($limit = PlanGate::studentLimitMessage($college->id)) {
                $errors[] = ['row' => $rowNum, 'message' => 'Not added: student limit reached. ' . $limit];
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

    /**
     * Who already holds this CNIC, in words an admin can act on. A CNIC is one
     * account across the whole platform, so it may belong to someone outside this
     * college; the other college is never named. Null when the CNIC is free.
     */
    private function cnicTaken(string $cnic, int $collegeId): ?array
    {
        if (strlen($cnic) !== 13) {
            return null;
        }
        $owner = User::withoutGlobalScopes()->where('cnic_no', $cnic)->first(['id', 'name', 'college_id', 'user_type']);
        if (!$owner) {
            return null;
        }

        if ((int) $owner->college_id === $collegeId && $owner->user_type === 'student') {
            return ['message' => "This CNIC is already registered to {$owner->name}, a student of this college.", 'student_id' => $owner->id];
        }
        if ((int) $owner->college_id === $collegeId) {
            return ['message' => 'This CNIC belongs to a staff account of this college.', 'student_id' => null];
        }
        return ['message' => 'This CNIC is already registered with another college on this platform, so it cannot be used again.', 'student_id' => null];
    }
}