<?php

namespace App\Http\Controllers;

use App\Models\Challan;
use App\Models\Program;
use App\Services\ChallanService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * College reports. Tenant-scoped: every query filters on the current college.
 */
class ReportController extends Controller
{
    public function __construct(private ChallanService $challanService) {}

    // ── Fee defaulters: students with unpaid / overdue challans, one row each ──
    // GET /api/reports/defaulters
    // Filters: program_id, semester_no, challan_type, overdue_only=1, search (name / CNIC)
    // Sort:    amount_due | challans_count | oldest_due | name
    public function defaulters(Request $request)
    {
        $collegeId = app('current_college')->id;
        $today     = Carbon::today()->toDateString();

        // Late fees are normally added when a challan is opened. Refresh them for
        // past-due challans first, so the totals here include them. Only on the
        // first page, so paging through the list stays fast.
        if ((int) $request->input('page', 1) === 1) {
            Challan::where('college_id', $collegeId)
                ->whereIn('status', ['unpaid', 'overdue'])
                ->whereDate('due_date', '<', $today)
                ->chunkById(200, function ($challans) {
                    foreach ($challans as $c) {
                        $this->challanService->applyLateFee($c);
                    }
                });
        }

        // Program of a challan: its own program_id, else the application's.
        $programExpr = 'COALESCE(c.program_id, a.program_id)';

        $query = DB::table('challans as c')
            ->join('users as u', 'u.id', '=', 'c.student_id')
            ->leftJoin('applications as a', 'a.id', '=', 'c.application_id')
            ->where('c.college_id', $collegeId)
            ->whereNull('c.deleted_at')
            ->whereIn('c.status', ['unpaid', 'overdue'])
            ->where('c.total_amount', '>', 0);

        if ($request->filled('program_id')) {
            $query->whereRaw("{$programExpr} = ?", [(int) $request->program_id]);
        }
        if ($request->filled('semester_no')) {
            $query->where('c.semester_no', (int) $request->semester_no);
        }
        if ($request->filled('challan_type')) {
            $query->where('c.challan_type', $request->challan_type);
        }
        if ($request->boolean('overdue_only')) {
            $query->whereDate('c.due_date', '<', $today);
        }
        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where(function ($q) use ($s) {
                $q->where('u.name', 'like', "%{$s}%")->orWhere('u.cnic_no', 'like', "%{$s}%");
            });
        }

        $query->groupBy('c.student_id', 'u.name', 'u.cnic_no')
            ->select([
                'c.student_id',
                'u.name',
                'u.cnic_no',
                DB::raw('COUNT(*) as challans_count'),
                DB::raw('SUM(c.total_amount) as amount_due'),
                DB::raw('MIN(c.due_date) as oldest_due'),
                DB::raw('MAX(c.semester_no) as semester_no'),
                DB::raw("MAX({$programExpr}) as program_id"),
                DB::raw("COUNT(DISTINCT {$programExpr}) as programs_count"),
            ]);

        // Grand total for the header, over the same filters (all pages).
        $summary = DB::query()->fromSub(clone $query, 'd')
            ->selectRaw('COUNT(*) as students, COALESCE(SUM(amount_due), 0) as amount_due')
            ->first();

        $sortable = ['amount_due', 'challans_count', 'oldest_due', 'name'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'amount_due';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';
        if (!$request->filled('sort_by')) {
            $sortDir = 'desc';   // default: biggest debt first
        }
        $perPage = min(max((int) ($request->per_page ?? 25), 1), 1000);

        $page = $query->orderBy($sortBy, $sortDir)->orderBy('u.name')->paginate($perPage);

        // Attach program name + scheme (Part vs Semester).
        $programs = Program::whereIn('id', collect($page->items())->pluck('program_id')->filter()->unique())
            ->get(['id', 'name', 'code', 'scheme'])->keyBy('id');

        $page->getCollection()->transform(function ($row) use ($programs, $today) {
            $p = $programs[$row->program_id] ?? null;
            $row->id             = $row->student_id;   // DataTable row key
            $row->program        = $p ? ['id' => $p->id, 'name' => $p->name, 'code' => $p->code, 'scheme' => $p->scheme] : null;
            $row->challans_count = (int) $row->challans_count;
            $row->programs_count = (int) $row->programs_count;
            $row->amount_due     = (float) $row->amount_due;
            $row->days_overdue   = max(0, (int) Carbon::parse($row->oldest_due)->diffInDays(Carbon::parse($today), false));
            return $row;
        });

        return response()->json(array_merge($page->toArray(), [
            'summary' => [
                'students'   => (int) ($summary->students ?? 0),
                'amount_due' => (float) ($summary->amount_due ?? 0),
            ],
        ]));
    }
}
