<?php

namespace App\Http\Controllers;

use App\Models\FeeStructure;
use App\Models\Program;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProgramController extends Controller
{
    // GET /api/programs
    // College admin: all programs. Public (tenant only): active ones only.
    public function index(Request $request)
    {
        $user  = $request->user();
        $query = Program::with('feeStructures');

        // Public/student access — only active programs
        if (!$user || $user->isStudent()) {
            $query->where('is_active', true);
        }

        if ($request->filled('degree_level')) {
            $query->where('degree_level', $request->degree_level);
        }

        // if ($request->filled('search')) {
        //     $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
        //     $query->where(function ($q) use ($s) {
        //         $q->where('name', 'like', "%{$s}%")
        //           ->orWhere('code', 'like', "%{$s}%");
        //     });
        // }

        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('code', 'like', "%{$s}%")
                  ->orWhere('degree_level', 'like', "%{$s}%")
                  ->orWhere('eligibility_criteria', 'like', "%{$s}%");
            });
        }

        $sortable = ['name', 'code', 'degree_level', 'duration_years', 'total_semesters', 'total_seats', 'is_active', 'created_at'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'created_at';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';

        $perPage = min(max((int) ($request->per_page ?? 15), 1), 1000);

        return response()->json($query->orderBy($sortBy, $sortDir)->paginate($perPage));

        // return response()->json($query->orderBy($sortBy, $sortDir)->paginate(15));

        // return response()->json($query->latest()->paginate(15));
    }

    // POST /api/programs — college admin only
    public function store(Request $request)
    {
        $request->validate([
            'name'                => 'required|string|max:255',
            // 'code'                => 'nullable|string|max:20',
            'code'                => [
                                    'nullable', 'string', 'max:20',
                                    Rule::unique('programs', 'code')
                                        ->where('college_id', app('current_college')->id),
            ],
            'degree_level'        => 'required|in:certificate,diploma,associate,bachelor,master,phd',
            'duration_years'      => 'required|integer|min:1|max:10',
            'total_semesters'     => 'required|integer|min:1|max:20',
            'total_seats'         => 'required|integer|min:1|max:1000',
            'eligibility_criteria'=> 'nullable|string|max:2000',
            'description'         => 'nullable|string|max:5000',
            'is_active'           => 'boolean',
        ]);

        $program = Program::create($request->only([
            'name', 'code', 'degree_level', 'duration_years',
            'total_semesters', 'total_seats',
            'eligibility_criteria', 'description', 'is_active',
        ]));

        return response()->json($program->load('feeStructures'), 201);
    }

    // GET /api/programs/{program}
    public function show(Program $program)
    {
        // return response()->json(
        //     $program->load('feeStructures')->append(['available_seats' => $program->availableSeats()])
        // );

        return response()->json(
            $program->load('feeStructures')->append('available_seats')
        );
    }

    // PUT /api/programs/{program} — college admin only
    public function update(Request $request, Program $program)
    {
        $request->validate([
            'name'                => 'sometimes|string|max:255',
            // 'code'                => 'nullable|string|max:20',
            'code'                => [
                                    'sometimes', 'nullable', 'string', 'max:20',
                                    Rule::unique('programs', 'code')
                                        ->where('college_id', app('current_college')->id)
                                        ->ignore($program->id),
            ],
            'degree_level'        => 'sometimes|in:certificate,diploma,associate,bachelor,master,phd',
            'duration_years'      => 'sometimes|integer|min:1|max:10',
            'total_semesters'     => 'sometimes|integer|min:1|max:20',
            'total_seats'         => 'sometimes|integer|min:1|max:1000',
            'eligibility_criteria'=> 'nullable|string|max:2000',
            'description'         => 'nullable|string|max:5000',
            'is_active'           => 'boolean',
        ]);

        $program->update($request->only([
            'name', 'code', 'degree_level', 'duration_years',
            'total_semesters', 'total_seats',
            'eligibility_criteria', 'description', 'is_active',
        ]));

        return response()->json($program->load('feeStructures'));
    }

    // DELETE /api/programs/{program} — college admin only
    public function destroy(Program $program)
    {
        // Block deletion if applications exist
        if ($program->applications()->exists()) {
            return response()->json([
                'message' => 'Cannot delete a program that has applications. Deactivate it instead.',
            ], 422);
        }

        $program->delete();

        return response()->json(['message' => 'Program deleted successfully.']);
    }

    // POST /api/programs/{program}/fee-structures
    public function storeFeeStructure(Request $request, Program $program)
    {
        $request->validate([
            'fee_type'       => 'required|in:admission,semester,exam,library,sports,security_deposit,arrears,other',
            'label'          => 'required|string|max:255',
            'amount'         => 'required|numeric|min:0',
            'semester_no'    => 'nullable|integer|min:1|max:20',
            'effective_from' => 'required|date',
            'effective_to'   => 'nullable|date|after:effective_from',
            'is_active'      => 'boolean',
        ]);

        $fee = FeeStructure::create(array_merge(
            $request->only([
                'fee_type', 'label', 'amount', 'semester_no',
                'effective_from', 'effective_to', 'is_active',
            ]),
            ['program_id' => $program->id]
        ));

        return response()->json($fee, 201);
    }

    // PUT /api/programs/{program}/fee-structures/{feeStructure}
    public function updateFeeStructure(Request $request, Program $program, FeeStructure $feeStructure)
    {
        // Ensure the fee belongs to this program (tenant scope already limits to the college).
        if ($feeStructure->program_id !== $program->id) {
            return response()->json(['message' => 'Fee structure not found for this program.'], 404);
        }

        $request->validate([
            'fee_type'       => 'sometimes|in:admission,semester,exam,library,sports,security_deposit,arrears,other',
            'label'          => 'sometimes|string|max:255',
            'amount'         => 'sometimes|numeric|min:0',
            'semester_no'    => 'nullable|integer|min:1|max:20',
            'effective_from' => 'sometimes|date',
            'effective_to'   => 'nullable|date|after:effective_from',
            'is_active'      => 'boolean',
        ]);

        $feeStructure->update($request->only([
            'fee_type', 'label', 'amount', 'semester_no',
            'effective_from', 'effective_to', 'is_active',
        ]));

        return response()->json($feeStructure->fresh());
    }

    // DELETE /api/programs/{program}/fee-structures/{feeStructure}
    public function destroyFeeStructure(Program $program, FeeStructure $feeStructure)
    {
        if ($feeStructure->program_id !== $program->id) {
           return response()->json(['message' => 'Fee structure not found for this program.'], 404);
        }
        $feeStructure->delete();
        return response()->json(['message' => 'Fee structure removed.']);
    }
}