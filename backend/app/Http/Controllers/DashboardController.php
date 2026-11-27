<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * College admin dashboard: the numbers an admin checks first, in one call.
 * Read-only. "Confirmed" payments use the same rule as the Fee Collection report
 * (no slip, or an approved slip), so the two always agree.
 */
class DashboardController extends Controller
{
    // GET /api/dashboard
    public function index(Request $request)
    {
        $collegeId  = app('current_college')->id;
        $today      = Carbon::today();
        $monthStart = $today->copy()->startOfMonth();
        $lastStart  = $monthStart->copy()->subMonthNoOverflow();
        $lastSameDay = $lastStart->copy()->addDays(min($today->day, $lastStart->daysInMonth) - 1);
        $d = fn (Carbon $c) => $c->toDateString();

        // ---- Students
        $students = DB::table('users')->where('college_id', $collegeId)->where('user_type', 'student');
        $approved = DB::table('applications')->where('applications.college_id', $collegeId)
            ->where('applications.status', 'approved')->whereNull('applications.deleted_at');

        $byProgram = (clone $approved)
            ->join('programs', 'programs.id', '=', 'applications.program_id')
            ->groupBy('programs.id', 'programs.name')
            ->orderByDesc(DB::raw('COUNT(DISTINCT applications.student_id)'))
            ->get(['programs.id', 'programs.name', DB::raw('COUNT(DISTINCT applications.student_id) as students')]);

        // ---- Applications
        $appCounts = DB::table('applications')->where('college_id', $collegeId)->whereNull('deleted_at')
            ->where('status', '!=', 'draft')
            ->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');

        $waiting = DB::table('applications as a')
            ->join('users as u', 'u.id', '=', 'a.student_id')
            ->join('programs as p', 'p.id', '=', 'a.program_id')
            ->where('a.college_id', $collegeId)->whereNull('a.deleted_at')
            ->whereIn('a.status', ['submitted', 'under_review'])
            ->orderBy('a.updated_at')->limit(5)
            ->get(['a.id', 'a.application_no', 'a.status', 'a.updated_at', 'u.name as student', 'p.name as program']);

        // ---- Fees
        $confirmed = DB::table('payments as p')
            ->join('challans as c', 'c.id', '=', 'p.challan_id')
            ->where('p.college_id', $collegeId)->whereNull('c.deleted_at')
            ->where(fn ($w) => $w->whereNull('p.slip_status')->orWhere('p.slip_status', 'approved'));

        $sum = fn ($from, $to) => (float) (clone $confirmed)->whereBetween('p.paid_at', [$from, $to])->sum('p.amount_paid');

        $from30 = $today->copy()->subDays(29);
        $daily = (clone $confirmed)->whereBetween('p.paid_at', [$d($from30), $d($today)])
            ->selectRaw('p.paid_at as day, SUM(p.amount_paid) as total')->groupBy('p.paid_at')
            ->pluck('total', 'day')->mapWithKeys(fn ($v, $k) => [substr((string) $k, 0, 10) => (float) $v]);
        $last30 = [];
        for ($c = $from30->copy(); $c->lte($today); $c->addDay()) {
            $last30[] = ['date' => $d($c), 'total' => $daily[$d($c)] ?? 0.0];
        }

        $open = DB::table('challans')->where('college_id', $collegeId)->whereNull('deleted_at')
            ->whereIn('status', ['unpaid', 'overdue'])->where('total_amount', '>', 0);
        $overdue = (clone $open)->whereDate('due_date', '<', $d($today));

        $recent = (clone $confirmed)
            ->join('users as u', 'u.id', '=', 'p.student_id')
            ->orderByDesc('p.paid_at')->orderByDesc('p.id')->limit(6)
            ->get(['p.id', 'p.amount_paid', 'p.payment_method', 'p.paid_at', 'c.id as challan_id', 'c.challan_no', 'u.name as student']);

        return response()->json([
            'today' => $d($today),
            'students' => [
                'total'          => (clone $students)->count(),
                'active'         => (clone $students)->where('is_active', true)->count(),
                'enrolled'       => (clone $approved)->distinct()->count('applications.student_id'),
                'new_this_month' => (clone $students)->where('created_at', '>=', $monthStart)->count(),
                'by_program'     => $byProgram,
            ],
            'applications' => [
                'submitted'    => (int) ($appCounts['submitted'] ?? 0),
                'under_review' => (int) ($appCounts['under_review'] ?? 0),
                'returned'     => (int) ($appCounts['returned'] ?? 0),
                'shortlisted'  => (int) ($appCounts['shortlisted'] ?? 0),
                'approved'     => (int) ($appCounts['approved'] ?? 0),
                'rejected'     => (int) ($appCounts['rejected'] ?? 0),
                'approved_this_month' => DB::table('applications')->where('college_id', $collegeId)->whereNull('deleted_at')
                    ->where('status', 'approved')->where('reviewed_at', '>=', $monthStart)->count(),
                'waiting'      => $waiting,
            ],
            'fees' => [
                'today'          => $sum($d($today), $d($today)),
                'this_month'     => $sum($d($monthStart), $d($today)),
                // Same span of last month (1st to the same day), so the comparison is fair mid-month.
                'last_month_same_period' => $sum($d($lastStart), $d($lastSameDay)),
                'outstanding'       => (float) (clone $open)->sum('total_amount'),
                'outstanding_count' => (clone $open)->count(),
                'overdue'           => (float) (clone $overdue)->sum('total_amount'),
                'overdue_count'     => (clone $overdue)->count(),
                'pending_slips'     => DB::table('payments')->where('college_id', $collegeId)->where('slip_status', 'pending')->count(),
                'last_30_days'      => $last30,
                'recent'            => $recent,
            ],
        ]);
    }
}
