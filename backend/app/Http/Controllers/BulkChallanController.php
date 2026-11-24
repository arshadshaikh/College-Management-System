<?php

namespace App\Http\Controllers;

use App\Models\Application;
use App\Models\AuditLog;
use App\Models\Challan;
use App\Models\Program;
use App\Services\ChallanService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Bulk challans: bill a whole class (program + Part/Semester) in one go.
 * A class = students with an approved admission in that program, now in that Part/Semester.
 * Fee lines come from the program's fee structure, the same rules as a single challan.
 */
class BulkChallanController extends Controller
{
    public function __construct(private ChallanService $challanService) {}

    // POST /api/challans/bulk/preview
    // What would be billed, and to whom. Nothing is saved.
    public function preview(Request $request)
    {
        $data = $this->validated($request);
        [$program, $fees, $title, $type] = $this->billing($data);

        $students = $this->classOf($program->id, (int) $data['semester_no'])
            ->map(function ($app) use ($fees, $data, $title) {
                $existing = $this->existingChallan($app->student_id, $fees, (int) $data['semester_no'], $title);
                return [
                    'id'             => $app->student_id,
                    'name'           => $app->student?->name,
                    'cnic_no'        => $app->student?->cnic_no,
                    'application_no' => $app->application_no,
                    'shift'          => $app->shift,
                    'admission_year' => $app->admission_year,
                    'existing'       => $existing ? $existing->only(['id', 'challan_no', 'status', 'total_amount']) : null,
                ];
            })->values();

        $extra = collect($data['items'] ?? []);

        return response()->json([
            'program'      => $program->only(['id', 'name', 'scheme', 'total_semesters']),
            'title'        => $title,
            'challan_type' => $type,
            'lines'        => $fees->map(fn ($f) => ['label' => $f->label, 'amount' => (float) $f->amount])
                                ->concat($extra->map(fn ($i) => ['label' => $i['label'], 'amount' => (float) $i['amount']]))
                                ->values(),
            'per_student'  => (float) $fees->sum('amount') + (float) $extra->sum('amount'),
            'students'     => $students,
        ]);
    }

    // POST /api/challans/bulk
    // Creates one challan per chosen student. Students not in the class, or already
    // billed for the same thing, are skipped (never billed twice).
    public function store(Request $request)
    {
        $data = $this->validated($request, true);
        [$program, $fees, $title, $type] = $this->billing($data);
        $semesterNo = (int) $data['semester_no'];

        $class   = $this->classOf($program->id, $semesterNo)->keyBy('student_id');
        $created = [];
        $skipped = [];

        foreach (array_unique($data['student_ids']) as $studentId) {
            $app = $class->get($studentId);
            if (!$app) {
                $skipped[] = ['id' => $studentId, 'reason' => 'Not in this class'];
                continue;
            }
            if ($this->existingChallan($studentId, $fees, $semesterNo, $title)) {
                $skipped[] = ['id' => $studentId, 'name' => $app->student?->name, 'reason' => 'Already billed'];
                continue;
            }

            $challan = DB::transaction(function () use ($app, $program, $data, $semesterNo, $title) {
                $challan = $this->challanService->generateForStudent(
                    student:    $app->student,
                    programId:  $program->id,
                    feeTypes:   $data['fee_types'],
                    semesterNo: $semesterNo,
                    dueDate:    Carbon::parse($data['due_date']),
                    title:      $title,
                    extraItems: $data['items'] ?? [],
                );
                AuditLog::record('challan.generated', $challan, [
                    'challan_no' => $challan->challan_no,
                    'scope'      => 'bulk',
                    'fee_types'  => $data['fee_types'],
                ]);
                return $challan;
            });

            $created[] = ['id' => $challan->id, 'challan_no' => $challan->challan_no, 'student' => $app->student?->name];
        }

        return response()->json([
            'message' => count($created) . ' challan(s) generated' . ($skipped ? ', ' . count($skipped) . ' skipped' : '') . '.',
            'created' => $created,
            'skipped' => $skipped,
            'total'   => round(count($created) * ((float) $fees->sum('amount') + (float) collect($data['items'] ?? [])->sum('amount')), 2),
        ], 201);
    }

    // ── helpers ──────────────────────────────────────────────────

    private function validated(Request $request, bool $withStudents = false): array
    {
        $collegeId = app('current_college')->id;

        $rules = [
            'program_id'     => ['required', 'integer', Rule::exists('programs', 'id')->where('college_id', $collegeId)],
            'semester_no'    => 'required|integer|min:1|max:20',
            'fee_types'      => 'required|array|min:1',
            'fee_types.*'    => ['string', Rule::exists('fee_types', 'slug')->where('college_id', $collegeId)->where('is_active', true)],
            'items'          => 'nullable|array|max:20',
            'items.*.label'  => 'required|string|max:255',
            'items.*.amount' => 'required|numeric|min:1',
            'due_date'       => 'required|date|after:today',
            'title'          => 'nullable|string|max:255',
        ];
        if ($withStudents) {
            $rules['student_ids']   = 'required|array|min:1|max:1000';
            $rules['student_ids.*'] = 'integer';
        }

        $data = $request->validate($rules, [
            'fee_types.required' => 'Choose at least one fee type.',
            'student_ids.required' => 'Choose at least one student.',
        ]);
        $data['fee_types'] = array_values(array_unique($data['fee_types']));
        return $data;
    }

    // [program, fee lines, title, challan_type] for this request. 422 when nothing would be billed.
    private function billing(array $data): array
    {
        $program    = Program::findOrFail($data['program_id']);
        $semesterNo = (int) $data['semester_no'];

        if ($semesterNo > $program->total_semesters) {
            abort(response()->json([
                'message' => "{$program->name} has {$program->total_semesters} {$program->termLabel()}s.",
                'errors'  => ['semester_no' => ["{$program->termLabel()} must be between 1 and {$program->total_semesters}."]],
            ], 422));
        }

        $fees = $this->challanService->feeLinesFor($program->id, $data['fee_types'], $semesterNo);
        $extra = (float) collect($data['items'] ?? [])->sum('amount');
        if ($fees->sum('amount') + $extra <= 0) {
            abort(response()->json([
                'message' => "No fees set for these fee types in {$program->termLabel()} {$semesterNo}.",
                'errors'  => ['fee_types' => ["{$program->name} has no active fees of these types for {$program->termLabel()} {$semesterNo}. Add them under Programs -> Fees, or add an item."]],
            ], 422));
        }

        $title = trim($data['title'] ?? '') ?: $this->challanService->titleFor($fees, $program->id, $semesterNo);
        $type  = $this->challanService->typeFor($fees);

        return [$program, $fees, $title, $type];
    }

    // The class: latest approved admission per student in this program and Part/Semester.
    private function classOf(int $programId, int $semesterNo): Collection
    {
        return Application::with('student:id,name,cnic_no,college_id')
            ->where('program_id', $programId)
            ->where('semester_no', $semesterNo)
            ->where('status', 'approved')
            ->orderByDesc('id')
            ->get()
            ->unique('student_id')
            ->filter(fn ($a) => $a->student !== null)
            ->sortBy(fn ($a) => mb_strtolower($a->student->name))
            ->values();
    }

    // Already billed = this student has a live challan (not cancelled, not Rs. 0) that
    // contains any of the same fee lines. Matching on the fee lines themselves means
    // "Admission" alone is caught even when it was billed inside "Admission + Exam".
    // With no fee lines (extra items only), the same title in the same Part counts.
    private function existingChallan(int $studentId, Collection $fees, int $semesterNo, string $title): ?Challan
    {
        $q = Challan::where('student_id', $studentId)
            ->where('status', '!=', 'cancelled')
            ->where('total_amount', '>', 0);

        $feeIds = $fees->pluck('id')->all();
        if ($feeIds) {
            $q->whereHas('items', fn ($i) => $i->whereIn('fee_structure_id', $feeIds));
        } else {
            $q->where('semester_no', $semesterNo)->where('title', $title);
        }

        return $q->latest('id')->first();
    }
}
