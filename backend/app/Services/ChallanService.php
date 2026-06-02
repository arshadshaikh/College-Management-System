<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Challan;
use App\Models\FeeStructure;
use Illuminate\Support\Carbon;

class ChallanService
{
    /**
     * Auto-generate an admission challan when application is approved.
     * Reads all active admission fee structures for the program.
     */
    public function generateAdmission(Application $application): Challan
    {
        $feeStructures = FeeStructure::where('program_id', $application->program_id)
            ->where('fee_type', 'admission')
            ->where('is_active', true)
            ->where('effective_from', '<=', now())
            ->where(function ($q) {
                $q->whereNull('effective_to')
                  ->orWhere('effective_to', '>=', now());
            })
            ->get();

        $breakdown = $feeStructures->map(fn($f) => [
            'label'    => $f->label,
            'fee_type' => $f->fee_type,
            'amount'   => (float) $f->amount,
        ])->toArray();

        $total = collect($breakdown)->sum('amount');

        // If no fee structures defined, create a zero challan
        // so the record still exists for tracking
        if (empty($breakdown)) {
            $breakdown = [['label' => 'Admission Fee', 'fee_type' => 'admission', 'amount' => 0]];
        }

        return Challan::create([
            'college_id'     => $application->college_id,
            'application_id' => $application->id,
            'student_id'     => $application->student_id,
            'challan_type'   => 'admission',
            'total_amount'   => $total,
            'issue_date'     => Carbon::today(),
            'due_date'       => Carbon::today()->addDays(30),
            'status'         => 'unpaid',
            'fee_breakdown'  => $breakdown,
        ]);
    }

    /**
     * Manually generate a semester or exam challan.
     */
    public function generateManual(
        Application $application,
        string $type,
        ?int $semesterNo,
        Carbon $dueDate
    ): Challan {
        $feeStructures = FeeStructure::where('program_id', $application->program_id)
            ->where('fee_type', $type)
            ->where('is_active', true)
            ->where('effective_from', '<=', now())
            ->where(function ($q) use ($semesterNo) {
                $q->whereNull('semester_no');
                if ($semesterNo) {
                    $q->orWhere('semester_no', $semesterNo);
                }
            })
            ->get();

        $breakdown = $feeStructures->map(fn($f) => [
            'label'       => $f->label,
            'fee_type'    => $f->fee_type,
            'semester_no' => $f->semester_no,
            'amount'      => (float) $f->amount,
        ])->toArray();

        $total = collect($breakdown)->sum('amount');

        return Challan::create([
            'college_id'     => $application->college_id,
            'application_id' => $application->id,
            'student_id'     => $application->student_id,
            'challan_type'   => $type,
            'semester_no'    => $semesterNo,
            'total_amount'   => $total,
            'issue_date'     => Carbon::today(),
            'due_date'       => $dueDate,
            'status'         => 'unpaid',
            'fee_breakdown'  => $breakdown ?: [['label' => ucfirst($type) . ' Fee', 'fee_type' => $type, 'amount' => 0]],
        ]);
    }
}