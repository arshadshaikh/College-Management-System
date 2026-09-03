<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Challan;
use App\Models\FeeStructure;
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
    public function generateFirstChallan(Application $application): Challan
    {
        $fees = $this->feesForSemester($application->program_id, 1);

        return $this->createChallan(
            application:   $application,
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
            application:   $application,
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

    // ------------------------------------------------------------------
    // Fee selection helpers — all respect active + effective-date window.
    // ------------------------------------------------------------------

    private function baseFeeQuery(int $programId)
    {
        return FeeStructure::where('program_id', $programId)
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
        Application $application,
        Collection $fees,
        string $challanType,
        string $title,
        ?int $semesterNo,
        ?int $installmentNo,
        string $scope,
        Carbon $dueDate,
        string $fallbackLabel,
    ): Challan {
        return DB::transaction(function () use (
            $application, $fees, $challanType, $title,
            $semesterNo, $installmentNo, $scope, $dueDate, $fallbackLabel
        ) {
            $challan = Challan::create([
                'college_id'     => $application->college_id,
                'application_id' => $application->id,
                'student_id'     => $application->student_id,
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

            if ($fees->isEmpty()) {
                // No matching fee structures: create a single zero line so the
                // challan is a valid record the admin can then fill in.
                $challan->items()->create([
                    'label'      => $fallbackLabel,
                    'amount'     => 0,
                    'type'       => 'fee',
                    'sort_order' => 0,
                ]);
            } else {
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
            }

            // total_amount = SUM(items). Single source of truth.
            $challan->recomputeTotal();

            return $challan->fresh('items');
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