<?php

namespace App\Http\Controllers;

use App\Models\Application;
use App\Models\Challan;
use App\Models\ChallanItem;
use App\Models\Payment;
use App\Models\AuditLog;
use App\Services\ChallanService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ChallanController extends Controller
{
    public function __construct(
        private ChallanService $challanService
    ) {}

    // ── College admin: list all challans ──────────────────────────
    // GET /api/challans
    public function index(Request $request)
    {
        $query = Challan::with(['student', 'application.program']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('challan_type')) {
            $query->where('challan_type', $request->challan_type);
        }

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        // return response()->json($query->latest()->paginate(15));

        $sortable = ['challan_no', 'challan_type', 'total_amount', 'status', 'issue_date', 'due_date', 'created_at'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'created_at';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';

        $perPage = min(max((int) ($request->per_page ?? 15), 1), 1000);

        return response()->json($query->orderBy($sortBy, $sortDir)->paginate($perPage));
    }

    // ── Student: their own challans ───────────────────────────────
    // GET /api/challans/my
    public function myChallans(Request $request)
    {
        $challans = Challan::with(['application.program', 'payments'])
            ->where('student_id', $request->user()->id)
            ->latest()
            ->paginate(15);

        return response()->json($challans);
    }

    // ── College admin: view single challan ────────────────────────
    // GET /api/challans/{challan}
    public function show(Challan $challan)
    {
        // Refresh the late fee (if the college's policy applies) before returning.
        // Idempotent + self-healing — safe on every view.
        $this->challanService->applyLateFee($challan);

        return response()->json(
            $challan->load(['items', 'student', 'application.program', 'payments.recordedBy'])
        );
    }

    // ── College admin: manually generate a challan by scope ────
    // POST /api/challans
    public function store(Request $request)
    {
        $request->validate([
            'application_id' => 'required|exists:applications,id',
            'scope'          => 'required|in:semester,year,program',
            'semester_no'    => 'nullable|integer|min:1|max:20',
            'semester_nos'   => 'nullable|array',
            'semester_nos.*' => 'integer|min:1|max:20',
            'due_date'       => 'required|date|after:today',
            'title'          => 'nullable|string|max:255',
            'installment_no' => 'nullable|integer|min:1|max:50',
        ]);

        $application = Application::findOrFail($request->application_id);

        if ($application->status !== 'approved') {
            return response()->json([
                'message' => 'Challan can only be generated for approved applications.',
            ], 422);
        }

        // For a single-semester challan, semester_no is required.
        if ($request->scope === 'semester' && !$request->filled('semester_no')) {
            return response()->json([
                'message' => 'semester_no is required for a semester challan.',
            ], 422);
        }

        $challan = $this->challanService->generateForScope(
            application:   $application,
            scope:         $request->scope,
            semesterNo:    $request->semester_no,
            dueDate:       Carbon::parse($request->due_date),
            semesterNos:   $request->semester_nos ?? [],
            title:         $request->title,
            installmentNo: $request->installment_no,
        );

        AuditLog::record('challan.generated', $challan, [
            'challan_no' => $challan->challan_no,
            'scope'      => $request->scope,
        ]);

        return response()->json([
            'message' => 'Challan generated successfully.',
            'challan' => $challan->load('items', 'application.program', 'student'),
        ], 201);
    }

    // ── Cancel a challan ──────────────────────────────────────────
    // POST /api/challans/{challan}/cancel
    public function cancel(Challan $challan)
    {
        if ($challan->status === 'paid') {
            return response()->json(['message' => 'Cannot cancel a paid challan.'], 422);
        }

        $challan->update(['status' => 'cancelled']);

        AuditLog::record('challan.cancelled', $challan, [
            'challan_no' => $challan->challan_no,
        ]);

        return response()->json(['message' => 'Challan cancelled.', 'challan' => $challan->fresh()]);
    }

    // ── Admin: mark challan as paid manually ──────────────────────
    // POST /api/challans/{challan}/mark-paid
    public function markPaid(Request $request, Challan $challan)
    {
        if ($challan->status === 'paid') {
            return response()->json(['message' => 'Challan is already paid.'], 422);
        }

        if ($challan->status === 'cancelled') {
            return response()->json(['message' => 'Cannot mark a cancelled challan as paid.'], 422);
        }

        $request->validate([
            'payment_method'    => 'required|in:cash,bank_transfer,online',
            'payment_reference' => 'nullable|string|max:255',
            'bank_name'         => 'nullable|string|max:255',
            'slip'              => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'paid_at'           => 'required|date',
            'notes'             => 'nullable|string|max:1000',
        ]);

        DB::beginTransaction();
        try {

            $slipPath = null;
            if ($request->hasFile('slip')) {
                $slipPath = $request->file('slip')->store(
                "colleges/{$challan->college_id}/slips/{$challan->id}",
                'private'
                );
            }

            Payment::create([
                'challan_id'        => $challan->id,
                'college_id'        => $challan->college_id,
                'student_id'        => $challan->student_id,
                'amount_paid'       => $challan->total_amount,
                'payment_method'    => $request->payment_method,
                'payment_reference' => $request->payment_reference,
                'bank_name'         => $request->bank_name,
                'slip_path'         => $slipPath,
                'paid_at'           => $request->paid_at,
                'notes'             => $request->notes,
                'recorded_by'       => $request->user()->id,
                'slip_verified'     => true,
                'slip_verified_by'  => $request->user()->id,
                'slip_verified_at'  => now(),
            ]);

            $challan->update(['status' => 'paid']);

            AuditLog::record('challan.marked_paid', $challan, [
                'challan_no'     => $challan->challan_no,
                'amount'         => $challan->total_amount,
                'payment_method' => $request->payment_method,
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'message' => 'Payment recorded and challan marked as paid.',
            'challan' => $challan->fresh()->load('payments'),
        ]);
    }

    // ── Student: upload payment slip ──────────────────────────────
    // POST /api/challans/{challan}/upload-slip
    public function uploadSlip(Request $request, Challan $challan)
    {
        // Only the challan's student can upload
        if ((int) $challan->student_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($challan->status !== 'unpaid' && $challan->status !== 'overdue') {
            return response()->json([
                'message' => 'Slip can only be uploaded for unpaid or overdue challans.',
            ], 422);
        }

        $request->validate([
            'slip'              => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'payment_reference' => 'nullable|string|max:255',
            'bank_name'         => 'nullable|string|max:255',
            'paid_at'           => 'required|date',
        ]);

        $college = app('current_college');
        $file    = $request->file('slip');
        $path    = $file->store(
            "colleges/{$college->id}/slips/{$challan->id}",
            'private'
        );

        // Create an unverified payment record
        $payment = Payment::create([
            'challan_id'        => $challan->id,
            'college_id'        => $challan->college_id,
            'student_id'        => $request->user()->id,
            'amount_paid'       => $challan->total_amount,
            'payment_method'    => 'bank_transfer',
            'payment_reference' => $request->payment_reference,
            'bank_name'         => $request->bank_name,
            'paid_at'           => $request->paid_at,
            'slip_path'         => $path,
            'slip_verified'     => false,
        ]);

        return response()->json([
            'message' => 'Payment slip uploaded. Awaiting admin verification.',
            'payment' => $payment,
        ], 201);
    }

    // ── Admin: verify uploaded payment slip ───────────────────────
    // POST /api/payments/{payment}/verify-slip
    public function verifySlip(Request $request, Payment $payment)
    {
        if ($payment->slip_verified) {
            return response()->json(['message' => 'Slip already verified.'], 422);
        }

        if (empty($payment->slip_path)) {
            return response()->json(['message' => 'No slip uploaded for this payment.'], 422);
        }

        $request->validate([
            'approved' => 'required|boolean',
            'notes'    => 'nullable|string|max:500',
        ]);

        DB::beginTransaction();
        try {
            $payment->update([
                'slip_verified'     => true,
                'slip_verified_by'  => $request->user()->id,
                'slip_verified_at'  => now(),
                'notes'             => $request->notes,
            ]);

            if ($request->approved) {
                $payment->challan->update(['status' => 'paid']);
            }

            AuditLog::record('payment.slip_verified', $payment, [
                'approved'   => $request->boolean('approved'),
                'challan_no' => $payment->challan->challan_no,
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'message' => $request->approved ? 'Slip verified. Challan marked as paid.' : 'Slip rejected.',
            'payment' => $payment->fresh(),
        ]);
    }

    // ── Download slip ─────────────────────────────────────────────
    // GET /api/payments/{payment}/slip
    public function downloadSlip(Payment $payment)
    {
        if (empty($payment->slip_path) || !Storage::disk('private')->exists($payment->slip_path)) {
            return response()->json(['message' => 'Slip not found.'], 404);
        }

        return Storage::disk('private')->download($payment->slip_path);
    }

        // ── Generate PDF challan ──────────────────────────────────────
    // GET /api/challans/{challan}/pdf
    public function pdf(Challan $challan)
    {
        $challan->load(['items', 'student', 'application.program', 'college']);

        // Generate a verification QR as a base64 PNG data URI (DomPDF embeds it inline).
        $verifyText = ($challan->college->name ?? '')
            . ' | Challan: ' . $challan->challan_no
            . ' | Amount: Rs. ' . number_format($challan->total_amount, 2);
        try {
            $qrPng = \SimpleSoftwareIO\QrCode\Facades\QrCode::format('png')
                ->size(200)->margin(0)->generate($verifyText);
            $qrData = 'data:image/png;base64,' . base64_encode($qrPng);
        } catch (\Throwable $e) {
            $qrData = null; // QR is optional; never let it break the PDF
        }

        // Resolve the college logo to a base64 data URI if one is set on the public disk.
        $logoData = null;
        $logoSetting = \App\Models\Setting::where('college_id', $challan->college_id)
            ->where('key', 'logo')->value('value');
        if ($logoSetting) {
            $path = str_replace('/storage/', '', parse_url($logoSetting, PHP_URL_PATH) ?? $logoSetting);
            if (\Illuminate\Support\Facades\Storage::disk('public')->exists($path)) {
                $bytes = \Illuminate\Support\Facades\Storage::disk('public')->get($path);
                $mime  = str_ends_with(strtolower($path), '.png') ? 'image/png' : 'image/jpeg';
                $logoData = 'data:' . $mime . ';base64,' . base64_encode($bytes);
            }
        }

        $pdf = Pdf::loadView('challans.pdf', [
            'challan'  => $challan,
            'college'  => $challan->college,
            'student'  => $challan->student,
            'program'  => $challan->application->program,
            'qrData'   => $qrData,
            'logoData' => $logoData,
        ])->setPaper('a4', 'landscape');

        return $pdf->download("challan-{$challan->challan_no}.pdf");
    }

    // GET /api/my-challans/{challan} — student views their OWN challan only.
    public function myShow(Request $request, Challan $challan)
    {
        // BelongsToTenant already scoped $challan to the college. Now enforce ownership.
        if ($challan->student_id !== $request->user()->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        return response()->json(
            $challan->load(['application.program', 'payments'])
        );
    }

    // ── College admin: add a line-item to a challan ───────────────
    // POST /api/challans/{challan}/items
    public function addItem(Request $request, Challan $challan)
    {
        if (!in_array($challan->status, ['unpaid', 'overdue'])) {
            return response()->json([
                'message' => 'Items can only be changed on an unpaid or overdue challan.',
            ], 422);
        }

        $validated = $request->validate([
            'label'  => 'required|string|max:255',
            'amount' => 'required|numeric',              // negative allowed (discount)
            'type'   => 'required|in:fee,discount,late_fee,conditional',
        ]);

        // Place new line at the end.
        $nextOrder = (int) $challan->items()->max('sort_order') + 1;

        $item = $challan->items()->create([
            'label'      => $validated['label'],
            'amount'     => $validated['amount'],
            'type'       => $validated['type'],
            'sort_order' => $nextOrder,
        ]);

        $challan->recomputeTotal();

        AuditLog::record('challan.item_added', $challan, [
            'challan_no' => $challan->challan_no,
            'label'      => $item->label,
            'amount'     => $item->amount,
            'type'       => $item->type,
        ]);

        return response()->json([
            'message' => 'Line-item added.',
            'challan' => $challan->fresh('items'),
        ], 201);
    }

    // ── College admin: edit a line-item ───────────────────────────
    // PUT /api/challans/{challan}/items/{item}
    public function updateItem(Request $request, Challan $challan, ChallanItem $item)
    {
        // Ensure the item belongs to this challan (defence in depth).
        if ((int) $item->challan_id !== (int) $challan->id) {
            return response()->json(['message' => 'Item does not belong to this challan.'], 404);
        }

        if (!in_array($challan->status, ['unpaid', 'overdue'])) {
            return response()->json([
                'message' => 'Items can only be changed on an unpaid or overdue challan.',
            ], 422);
        }

        $validated = $request->validate([
            'label'  => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric',
            'type'   => 'sometimes|in:fee,discount,late_fee,conditional',
        ]);

        $item->update($validated);
        $challan->recomputeTotal();

        AuditLog::record('challan.item_updated', $challan, [
            'challan_no' => $challan->challan_no,
            'item_id'    => $item->id,
            'label'      => $item->label,
            'amount'     => $item->amount,
        ]);

        return response()->json([
            'message' => 'Line-item updated.',
            'challan' => $challan->fresh('items'),
        ]);
    }

    // ── College admin: remove a line-item ─────────────────────────
    // DELETE /api/challans/{challan}/items/{item}
    public function deleteItem(Challan $challan, ChallanItem $item)
    {
        if ((int) $item->challan_id !== (int) $challan->id) {
            return response()->json(['message' => 'Item does not belong to this challan.'], 404);
        }

        if (!in_array($challan->status, ['unpaid', 'overdue'])) {
            return response()->json([
                'message' => 'Items can only be changed on an unpaid or overdue challan.',
            ], 422);
        }

        $snapshot = ['label' => $item->label, 'amount' => $item->amount, 'type' => $item->type];
        $item->delete();
        $challan->recomputeTotal();

        AuditLog::record('challan.item_removed', $challan, array_merge(
            ['challan_no' => $challan->challan_no],
            $snapshot
        ));

        return response()->json([
            'message' => 'Line-item removed.',
            'challan' => $challan->fresh('items'),
        ]);
    }

}