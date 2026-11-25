<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use Illuminate\Http\Request;

/**
 * Payment slip queue: every slip students uploaded, newest work first.
 * Review (approve / reject) uses the existing POST /api/payments/{id}/verify-slip,
 * and the file itself the existing GET /api/payments/{id}/slip.
 */
class PaymentSlipController extends Controller
{
    // GET /api/payments/slips?status=pending|approved|rejected|all&search=&sort_by=&sort_dir=&per_page=
    public function index(Request $request)
    {
        $status = in_array($request->status, ['pending', 'approved', 'rejected', 'all'], true) ? $request->status : 'pending';

        $query = Payment::with([
                'student:id,name,cnic_no',
                'challan:id,challan_no,title,challan_type,total_amount,status,due_date,semester_no,program_id,application_id',
                'challan.program:id,name,scheme',
                'challan.application.program:id,name,scheme',
                'verifiedBy:id,name',
            ])
            ->whereNotNull('slip_path')
            ->whereNotNull('slip_status');

        if ($status !== 'all') {
            $query->where('slip_status', $status);
        }

        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where(function ($q) use ($s) {
                $q->where('payment_reference', 'like', "%{$s}%")
                  ->orWhereHas('student', fn ($u) => $u->where('name', 'like', "%{$s}%")->orWhere('cnic_no', 'like', "%{$s}%"))
                  ->orWhereHas('challan', fn ($c) => $c->where('challan_no', 'like', "%{$s}%"));
            });
        }

        // Pending: oldest first (first come, first served). Others: latest first.
        $sortable = ['created_at', 'paid_at', 'amount_paid', 'slip_verified_at'];
        $sortBy   = in_array($request->sort_by, $sortable, true) ? $request->sort_by : 'created_at';
        $sortDir  = $request->filled('sort_by')
            ? ($request->sort_dir === 'asc' ? 'asc' : 'desc')
            : ($status === 'pending' ? 'asc' : 'desc');

        $perPage = min(max((int) ($request->per_page ?? 25), 1), 1000);

        $page = $query->orderBy($sortBy, $sortDir)->orderBy('id')->paginate($perPage);

        // Tab badges.
        $counts = Payment::whereNotNull('slip_path')->whereNotNull('slip_status')
            ->selectRaw('slip_status, COUNT(*) as n')->groupBy('slip_status')->pluck('n', 'slip_status');

        return response()->json(array_merge($page->toArray(), [
            'counts' => [
                'pending'  => (int) ($counts['pending'] ?? 0),
                'approved' => (int) ($counts['approved'] ?? 0),
                'rejected' => (int) ($counts['rejected'] ?? 0),
            ],
        ]));
    }
}
