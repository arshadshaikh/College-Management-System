<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Challan;
use App\Models\FeeStructure;
use App\Models\FeeType;
use App\Models\Program;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ChallanService
{
    /**
     * Auto-generate the FIRST challan when an application is approved.
     *
     * Default policy (see project notes): the first challan carries Semester 1's
     * fee lines, billed as "Installment 1". One-time / null-semester fees
     * (registration, etc.) are NOT swept in automatically — the admin adds those
     * deliberately. Everything here is editable afterward by the admin.
     */
    public function generateFirstChallan(Application $application): ?Challan
    {
        $fees = $this->feesForSemester($application->program_id, 1);

        // No semester-1 fees set up: approve without a challan (never a Rs. 0 challan).
        if ($fees->isEmpty()) {
            return null;
        }

        return $this->createChallan(
            owner:         $this->ownerFromApplication($application),
            fees:          $fees,
            challanType:   'semester',
            title:         'First Semester Installment Fee',
            semesterNo:    1,
            installmentNo: 1,
            scope:         'semester',
            dueDate:       Carbon::today()->addDays(30),
            fallbackLabel: 'First Semester Installment Fee',
        );
    }

    /**
     * Generate a challan for a chosen SCOPE. This is the manual/admin path.
     *
     *   scope = 'semester' -> that one semester's fee lines
     *   scope = 'year'     -> the semesters in $semesterNos (a range you pass)
     *   scope = 'program'  -> every semester's fee lines for the program
     *
     * $semesterNo is the primary semester (used for label/installment on
     * 'semester'); $semesterNos is the explicit list for 'year'.
     */
    public function generateForScope(
        Application $application,
        string $scope,
        ?int $semesterNo,
        Carbon $dueDate,
        array $semesterNos = [],
        ?string $title = null,
        ?int $installmentNo = null,
    ): Challan {
        $fees = match ($scope) {
            'semester' => $this->feesForSemester($application->program_id, $semesterNo),
            'year'     => $this->feesForSemesters($application->program_id, $semesterNos),
            'program'  => $this->feesForProgram($application->program_id),
            default    => collect(),
        };

        $defaultTitle = match ($scope) {
            'semester' => 'Semester ' . $semesterNo . ' Fee',
            'year'     => 'Annual Fee (Semesters ' . implode(', ', $semesterNos) . ')',
            'program'  => 'Full Program Fee',
            default    => 'Fee Challan',
        };

        return $this->createChallan(
            owner:         $this->ownerFromApplication($application),
            fees:          $fees,
            challanType:   'semester',
            title:         $title ?? $defaultTitle,
            semesterNo:    $scope === 'semester' ? $semesterNo : null,
            installmentNo: $installmentNo,
            scope:         $scope,
            dueDate:       $dueDate,
            fallbackLabel: $defaultTitle,
        );
    }

    /**
     * Challan for ANY student, no admission application needed (hostel,
     * transcript, exam, fines ...).
     *
     *   $feeTypes   fee type slugs; their active fee lines are taken from the
     *               program's fee structure (needs $programId)
     *   $semesterNo part/semester: lines for that part + lines with no part.
     *               null = only lines with no part (one-time fees)
     *   $extraItems [['label' => ..., 'amount' => ...]] typed in by the admin
     *
     * Refuses (422) when nothing adds up to more than Rs. 0.
     */
    public function generateForStudent(
        User $student,
        ?int $programId,
        array $feeTypes,
        ?int $semesterNo,
        Carbon $dueDate,
        ?string $title = null,
        array $extraItems = [],
        string $candidateType = 'regular',   // regular | private
        string $examType = 'regular',        // regular | failure
        ?string $challanType = null,         // default: the single fee type used, else 'other'
    ): Challan {
        $fees         = $this->feeLinesFor($programId, $feeTypes, $semesterNo, $candidateType, $examType);
        $used         = $fees->pluck('fee_type')->unique()->values()->all();
        $defaultTitle = $this->titleFor($fees, $programId, $semesterNo, $candidateType, $examType);

        return $this->createChallan(
            owner:         [
                'college_id'     => $student->college_id,
                'application_id' => null,
                'program_id'     => $programId,
                'student_id'     => $student->id,
                'candidate_type' => $candidateType,
                'exam_type'      => $examType,
            ],
            fees:          $fees,
            challanType:   $challanType ?? (count($used) === 1 ? $used[0] : 'other'),
            title:         $title ?: $defaultTitle,
            semesterNo:    $semesterNo,
            installmentNo: null,
            scope:         'custom',
            dueDate:       $dueDate,
            fallbackLabel: $defaultTitle,
            extraItems:    $extraItems,
        );
    }

    /**
     * Fee lines a student challan bills: the program's active lines of these fee types,
     * for this Part/Semester plus lines with no Part (one-time fees).
     * Public so the bulk preview shows exactly what will be billed.
     */
    public function feeLinesFor(?int $programId, array $feeTypes, ?int $semesterNo,
                                string $candidateType = 'regular', string $examType = 'regular'): Collection
    {
        if (!$programId || !$feeTypes) {
            return collect();
        }
        return $this->baseFeeQuery($programId, $candidateType, $examType)
            ->whereIn('fee_type', $feeTypes)
            ->where(function ($q) use ($semesterNo) {
                $q->whereNull('semester_no');
                if ($semesterNo) {
                    $q->orWhere('semester_no', $semesterNo);
                }
            })
            ->orderByRaw('semester_no IS NULL')->orderBy('id')
            ->get();
    }

    // Default challan title, e.g. "Tuition + Exam Fee (Part 2)". Uses the fee types that
    // actually produced lines, not every chip tapped.
    public function titleFor(Collection $fees, ?int $programId, ?int $semesterNo,
                             string $candidateType = 'regular', string $examType = 'regular'): string
    {
        $used  = $fees->pluck('fee_type')->unique()->values()->all();
        $names = FeeType::whereIn('slug', $used)->orderBy('sort_order')->pluck('name')->all();

        $title = $names ? implode(' + ', $names) . ' Fee' : 'Fee Challan';
        if ($semesterNo && $programId) {
            $title .= ' (' . Program::find($programId)?->termLabel() . ' ' . $semesterNo . ')';
        }
        // Mark non-default candidates/exams, e.g. "Exam Fee (Part 2) - Private, Failure".
        $flags = array_filter([$candidateType === 'private' ? 'Private' : null, $examType === 'failure' ? 'Failure' : null]);
        if ($flags) {
            $title .= ' - ' . implode(', ', $flags);
        }
        return $title;
    }

    // challan_type the student challan gets: the one fee type used, else 'other'.
    public function typeFor(Collection $fees): string
    {
        $used = $fees->pluck('fee_type')->unique()->values()->all();
        return count($used) === 1 ? $used[0] : 'other';
    }

    private function ownerFromApplication(Application $application): array
    {
        return [
            'college_id'     => $application->college_id,
            'application_id' => $application->id,
            'program_id'     => $application->program_id,
            'student_id'     => $application->student_id,
        ];
    }

    // ------------------------------------------------------------------
    // Fee selection helpers — all respect active + effective-date window.
    // ------------------------------------------------------------------

    // Active, in-date lines of a program that apply to this candidate and exam:
    // lines marked 'any' plus lines for exactly this candidate/exam type.
    // Admission/semester challans bill as a regular candidate in a regular exam.
    private function baseFeeQuery(int $programId, string $candidateType = 'regular', string $examType = 'regular')
    {
        return FeeStructure::where('program_id', $programId)
            ->whereIn('candidate_type', ['any', $candidateType])
            ->whereIn('exam_type', ['any', $examType])
            ->where('is_active', true)
            ->where('effective_from', '<=', now())
            ->where(function ($q) {
                $q->whereNull('effective_to')
                  ->orWhere('effective_to', '>=', now());
            });
    }

    private function feesForSemester(int $programId, ?int $semesterNo): Collection
    {
        return $this->baseFeeQuery($programId)
            ->where('semester_no', $semesterNo)
            ->get();
    }

    private function feesForSemesters(int $programId, array $semesterNos): Collection
    {
        if (empty($semesterNos)) {
            return collect();
        }

        return $this->baseFeeQuery($programId)
            ->whereIn('semester_no', $semesterNos)
            ->get();
    }

    private function feesForProgram(int $programId): Collection
    {
        // Every semester-tagged fee line for the program (excludes null-semester
        // one-time fees, which are added deliberately by the admin).
        return $this->baseFeeQuery($programId)
            ->whereNotNull('semester_no')
            ->orderBy('semester_no')
            ->get();
    }

    // ------------------------------------------------------------------
    // Core creator — one place that builds a challan + its line-items.
    // ------------------------------------------------------------------

    /**
     * @param  Collection<int,FeeStructure>  $fees
     */
    private function createChallan(
        array $owner,               // college_id, application_id (nullable), program_id, student_id
        Collection $fees,
        string $challanType,
        string $title,
        ?int $semesterNo,
        ?int $installmentNo,
        string $scope,
        Carbon $dueDate,
        string $fallbackLabel,
        array $extraItems = [],     // [['label' => ..., 'amount' => ...]] typed in by the admin
    ): Challan {
        // Never create a Rs. 0 challan: something must be billed.
        $total = (float) $fees->sum('amount') + (float) collect($extraItems)->sum('amount');
        if ($total <= 0) {
            throw ValidationException::withMessages([
                'fee_types' => 'No fees to bill. Set up active fees for this program (Programs -> Fees) or add an item with an amount.',
            ]);
        }

        // Line order = fee type order from Settings -> Fees & Challans, then part, then oldest first.
        $typeOrder = FeeType::withoutTenantScope()->where('college_id', $owner['college_id'])->pluck('sort_order', 'slug');
        $fees = $fees->sortBy(fn ($f) => [$typeOrder[$f->fee_type] ?? 9999, $f->semester_no ?? 0, $f->id])->values();

        return DB::transaction(function () use (
            $owner, $fees, $challanType, $title,
            $semesterNo, $installmentNo, $scope, $dueDate, $fallbackLabel, $extraItems
        ) {
            $challan = Challan::create($owner + [
                'challan_type'   => $challanType,
                'title'          => $title,
                'semester_no'    => $semesterNo,
                'installment_no' => $installmentNo,
                'scope'          => $scope,
                'total_amount'   => 0, // recomputed from items below
                'issue_date'     => Carbon::today(),
                'due_date'       => $dueDate,
                'status'         => 'unpaid',
                // fee_breakdown kept temporarily as a denormalized snapshot for
                // any old code/PDF still reading it; source of truth is items.
                'fee_breakdown'  => $fees->map(fn ($f) => [
                    'label'  => $f->label,
                    'amount' => (float) $f->amount,
                ])->values()->all(),
            ]);

            $order = 0;
            foreach ($fees as $fee) {
                $challan->items()->create([
                    'label'            => $fee->label,
                    'amount'           => $fee->amount,
                    'type'             => 'fee',
                    'fee_structure_id' => $fee->id,
                    'sort_order'       => $order++,
                ]);
            }
            // Admin-typed lines (e.g. "Duplicate ID card"), billed as conditional charges.
            foreach ($extraItems as $item) {
                $challan->items()->create([
                    'label'      => $item['label'] ?: $fallbackLabel,
                    'amount'     => $item['amount'],
                    'type'       => 'conditional',
                    'sort_order' => $order++,
                ]);
            }

            // total_amount = SUM(items). Single source of truth.
            $challan->recomputeTotal();

            return $challan->fresh('items');
        });
    }


    /**
     * Split an unpaid challan into installments. $parts = [['amount' => .., 'due_date' => Y-m-d], ...]
     * in order; the amounts must add up to the challan's total without its late fee.
     *
     * Every fee line is shared out in proportion to each part's amount (whole rupees),
     * so each installment still shows Admission, Exam ... and reports by fee type stay
     * right. The last part takes what is left of each line, so nothing is lost to rounding.
     * The late fee is not carried over: each installment earns its own after its due date.
     * The original challan is cancelled and linked as the parent. Caller checks eligibility.
     */
    public function splitIntoInstallments(Challan $challan, array $parts): Collection
    {
        $lines = $challan->items()->where('type', '!=', 'late_fee')->orderBy('sort_order')->get();
        $base  = (float) $lines->sum('amount');
        $count = count($parts);

        return DB::transaction(function () use ($challan, $parts, $lines, $base, $count) {
            $given   = array_fill(0, $lines->count(), 0.0);   // per line, shared out so far
            $created = collect();

            foreach (array_values($parts) as $k => $part) {
                $amount = round((float) $part['amount'], 2);
                $last   = $k === $count - 1;

                // This part's share of each line.
                $shares = [];
                foreach ($lines->values() as $i => $line) {
                    $shares[$i] = $last
                        ? round((float) $line->amount - $given[$i], 2)
                        : round((float) $line->amount * $amount / $base);
                }
                // Rounding leftovers go on the biggest line, so the part totals exactly $amount.
                if (!$last) {
                    $diff = round($amount - array_sum($shares), 2);
                    if ($diff != 0.0 && $shares) {
                        $big = $lines->values()->keys()->sortByDesc(fn ($i) => (float) $lines->values()[$i]->amount)->first();
                        $shares[$big] = round($shares[$big] + $diff, 2);
                    }
                }

                $n = $k + 1;
                $title = mb_substr(($challan->title ?: 'Fee Challan') . " - Installment {$n} of {$count}", 0, 255);

                $child = Challan::create([
                    'college_id'         => $challan->college_id,
                    'application_id'     => $challan->application_id,
                    'program_id'         => $challan->program_id,
                    'student_id'         => $challan->student_id,
                    'candidate_type'     => $challan->candidate_type,
                    'exam_type'          => $challan->exam_type,
                    'challan_type'       => $challan->challan_type,
                    'title'              => $title,
                    'semester_no'        => $challan->semester_no,
                    'installment_no'     => $n,
                    'installments_count' => $count,
                    'parent_challan_id'  => $challan->id,
                    'scope'              => $challan->scope,
                    'total_amount'       => 0,
                    'issue_date'         => Carbon::today(),
                    'due_date'           => Carbon::parse($part['due_date']),
                    'status'             => 'unpaid',
                    'fee_breakdown'      => [],
                ]);

                $breakdown = [];
                foreach ($lines->values() as $i => $line) {
                    $given[$i] = round($given[$i] + $shares[$i], 2);
                    if (abs($shares[$i]) < 0.005) {
                        continue;   // nothing of this line in this part
                    }
                    $child->items()->create([
                        'label'            => $line->label,
                        'amount'           => $shares[$i],
                        'type'             => $line->type,
                        'fee_structure_id' => $line->fee_structure_id,
                        'sort_order'       => $line->sort_order,
                    ]);
                    $breakdown[] = ['label' => $line->label, 'amount' => $shares[$i]];
                }
                $child->fee_breakdown = $breakdown;
                $child->recomputeTotal();
                $created->push($child->fresh('items'));
            }

            // The original is replaced by its installments. Its late fee line goes with it.
            $challan->items()->where('type', 'late_fee')->delete();
            $challan->recomputeTotal();
            $challan->update(['status' => 'cancelled']);

            return $created;
        });
    }

    /**
     * Apply (or refresh) the late fee on a challan, per the college's late-fee
     * policy. Fully configurable: mode (off/flat/per_week/per_month), amount,
     * and partial-period handling (from_day_one/full_period) are all settings.
     *
     * Idempotent: keeps a single late-fee line, updated each call — never stacks.
     * Self-healing: removes the line if the policy is turned off or the challan
     * is no longer overdue. Safe to call on every challan view.
     */
    public function applyLateFee(Challan $challan): Challan
    {
        // Only unpaid/overdue challans accrue late fees. Paid/cancelled are locked.
        if (!in_array($challan->status, ['unpaid', 'overdue'], true)) {
            return $challan;
        }

        // A challan with no fee lines (e.g. an old one from before line items) never gets
        // a late fee on its own: the late fee would become the whole challan.
        if (!$challan->items()->where('type', '!=', 'late_fee')->exists()) {
            return $challan;
        }

        $today    = Carbon::today();
        $dueDate  = $challan->due_date->copy()->startOfDay();
        $existing = $challan->items()->where('type', 'late_fee')->first();

        // Helper: drop any stale late-fee line and recompute.
        $removeExisting = function () use ($challan, $existing) {
            if ($existing) {
                $existing->delete();
                $challan->recomputeTotal();
                return $challan->fresh('items');
            }
            return $challan;
        };

        // Not overdue yet → ensure no stale late fee, stop.
        if ($today->lte($dueDate)) {
            return $removeExisting();
        }

        // Resolve policy (platform can enforce; otherwise the college decides).
        $mode    = PolicyService::resolve('late_fee_mode_policy',    'late_fee_mode',    $challan->college_id, 'off');
        $amount  = (float) PolicyService::resolve('late_fee_amount_policy',  'late_fee_amount',  $challan->college_id, '0');
        $partial = PolicyService::resolve('late_fee_partial_policy', 'late_fee_partial', $challan->college_id, 'from_day_one');

        // Policy off or no amount → remove any existing late fee, stop.
        if ($mode === 'off' || $amount <= 0) {
            return $removeExisting();
        }

        $floor  = $partial === 'from_day_one' ? 1 : 0; // min periods charged
        $weeks  = (int) $dueDate->diffInWeeks($today);
        $months = (int) $dueDate->diffInMonths($today);

        $fee = match ($mode) {
            'flat'      => $amount,
            'per_week'  => $amount * max($floor, $weeks),
            'per_month' => $amount * max($floor, $months),
            default     => 0,
        };

        // full_period mode before the first period completes → fee 0, no line.
        if ($fee <= 0) {
            return $removeExisting();
        }

        $label = 'Late Fee' . match ($mode) {
            'per_week'  => ' (' . max($floor, $weeks) . ' week(s) overdue)',
            'per_month' => ' (' . max($floor, $months) . ' month(s) overdue)',
            default     => '',
        };

        // Update the single late-fee line, or create it. Idempotent.
        if ($existing) {
            $existing->update(['label' => $label, 'amount' => $fee]);
        } else {
            $challan->items()->create([
                'label'      => $label,
                'amount'     => $fee,
                'type'       => 'late_fee',
                'sort_order' => 999, // always last
            ]);
        }

        // Reflect overdue status if still marked unpaid.
        if ($challan->status === 'unpaid') {
            $challan->update(['status' => 'overdue']);
        }

        $challan->recomputeTotal();
        return $challan->fresh('items');
    }

}