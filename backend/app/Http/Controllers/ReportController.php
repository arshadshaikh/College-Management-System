<?php

namespace App\Http\Controllers;

use App\Models\Challan;
use App\Models\FeeType;
use App\Models\Program;
use Barryvdh\DomPDF\Facade\Pdf;
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

    // ── Fee collection: money actually received in a date range ──────────
    // A payment counts once it is confirmed: recorded by an admin (cash / bank,
    // slip_status NULL) or a student slip that was approved. Pending and
    // rejected slips are not money in hand, so they are left out.
    // Dated by paid_at (the day the money reached the bank or the counter).

    // GET /api/reports/collections
    // Filters: from, to (Y-m-d, default today), program_id, payment_method, search
    // Sort:    paid_at | amount_paid | name | challan_no
    public function collections(Request $request)
    {
        [$from, $to] = $this->collectionRange($request);
        $base = $this->collectionsQuery($request, $from, $to);

        $sortable = ['paid_at' => 'p.paid_at', 'amount_paid' => 'p.amount_paid', 'name' => 'u.name', 'challan_no' => 'c.challan_no'];
        $sortBy   = $sortable[$request->sort_by] ?? 'p.paid_at';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';
        $perPage  = min(max((int) ($request->per_page ?? 25), 1), 1000);

        $page = (clone $base)
            ->select($this->collectionColumns())
            ->orderBy($sortBy, $sortDir)->orderByDesc('p.id')
            ->paginate($perPage);

        $programs = $this->programsFor(collect($page->items())->pluck('program_id'));
        $page->getCollection()->transform(fn ($row) => $this->shapeCollectionRow($row, $programs));

        return response()->json(array_merge($page->toArray(), [
            'range'   => ['from' => $from, 'to' => $to],
            'summary' => $this->collectionSummary($base),
        ]));
    }

    // GET /api/reports/collections/pdf — same filters, printable A4 summary + list.
    public function collectionsPdf(Request $request)
    {
        [$from, $to] = $this->collectionRange($request);
        $base    = $this->collectionsQuery($request, $from, $to);
        $college = app('current_college');

        $rows = (clone $base)->select($this->collectionColumns())
            ->orderBy('p.paid_at')->orderBy('p.id')
            ->limit(3000)->get();
        $programs = $this->programsFor($rows->pluck('program_id'));
        $rows = $rows->map(fn ($row) => $this->shapeCollectionRow($row, $programs));

        $program = $request->filled('program_id') ? Program::find((int) $request->program_id) : null;

        $pdf = Pdf::loadView('reports.collections', [
            'college'     => $college,
            'from'        => Carbon::parse($from),
            'to'          => Carbon::parse($to),
            'summary'     => $this->collectionSummary($base),
            'rows'        => $rows,
            'program'     => $program,
            'method'      => $request->payment_method,
            'search'      => $request->search,
            'generatedBy' => $request->user()->name,
            'logoData'    => $this->collegeLogoData($college->id),
        ])->setPaper('a4', 'portrait');

        $name = $from === $to ? "fee-collection-{$from}.pdf" : "fee-collection-{$from}-to-{$to}.pdf";
        return $pdf->download($name);
    }

    private function collectionRange(Request $request): array
    {
        $request->validate([
            'from'           => 'nullable|date',
            'to'             => 'nullable|date',
            'program_id'     => 'nullable|integer',
            'payment_method' => 'nullable|in:cash,bank_transfer,online',
        ]);
        $today = Carbon::today()->toDateString();
        $from  = $request->filled('from') ? Carbon::parse($request->from)->toDateString() : $today;
        $to    = $request->filled('to') ? Carbon::parse($request->to)->toDateString() : $from;
        if ($from > $to) {
            [$from, $to] = [$to, $from];
        }
        return [$from, $to];
    }

    private function collectionsQuery(Request $request, string $from, string $to)
    {
        $collegeId = app('current_college')->id;

        $q = DB::table('payments as p')
            ->join('challans as c', 'c.id', '=', 'p.challan_id')
            ->join('users as u', 'u.id', '=', 'p.student_id')
            ->leftJoin('applications as a', 'a.id', '=', 'c.application_id')
            ->leftJoin('users as r', 'r.id', '=', DB::raw('COALESCE(p.slip_verified_by, p.recorded_by)'))
            ->where('p.college_id', $collegeId)
            ->whereNull('c.deleted_at')
            ->where(fn ($w) => $w->whereNull('p.slip_status')->orWhere('p.slip_status', 'approved'))
            ->whereBetween('p.paid_at', [$from, $to]);

        if ($request->filled('program_id')) {
            $q->whereRaw('COALESCE(c.program_id, a.program_id) = ?', [(int) $request->program_id]);
        }
        if ($request->filled('payment_method')) {
            $q->where('p.payment_method', $request->payment_method);
        }
        if ($request->filled('search')) {
            $s = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $q->where(function ($w) use ($s) {
                $w->where('u.name', 'like', "%{$s}%")
                  ->orWhere('u.cnic_no', 'like', "%{$s}%")
                  ->orWhere('c.challan_no', 'like', "%{$s}%")
                  ->orWhere('p.payment_reference', 'like', "%{$s}%");
            });
        }
        return $q;
    }

    private function collectionColumns(): array
    {
        return [
            'p.id', 'p.paid_at', 'p.amount_paid', 'p.payment_method', 'p.payment_reference', 'p.bank_name',
            'p.slip_status', 'p.challan_id', 'p.student_id',
            'c.challan_no', 'c.title', 'c.semester_no',
            'u.name', 'u.cnic_no',
            DB::raw('COALESCE(c.program_id, a.program_id) as program_id'),
            DB::raw('r.name as received_by'),
        ];
    }

    private function programsFor($ids)
    {
        return Program::whereIn('id', collect($ids)->filter()->unique()->values())
            ->get(['id', 'name', 'code', 'scheme'])->keyBy('id');
    }

    private function shapeCollectionRow($row, $programs)
    {
        $p = $programs[$row->program_id] ?? null;
        $row->program     = $p ? ['id' => $p->id, 'name' => $p->name, 'code' => $p->code, 'scheme' => $p->scheme] : null;
        $row->amount_paid = (float) $row->amount_paid;
        $row->paid_at     = Carbon::parse($row->paid_at)->toDateString();
        $row->source      = $row->slip_status === 'approved' ? 'slip' : 'counter';   // student slip vs. recorded by staff
        return $row;
    }

    // Totals, split by payment method, by fee type (from the challan lines) and by day.
    private function collectionSummary($base): array
    {
        $totals = (clone $base)->selectRaw('COUNT(*) as payments, COUNT(DISTINCT p.student_id) as students, COALESCE(SUM(p.amount_paid), 0) as total')->first();
        $total  = (float) ($totals->total ?? 0);

        $methodNames = ['cash' => 'Cash', 'bank_transfer' => 'Bank deposit', 'online' => 'Online'];
        $byMethod = (clone $base)
            ->groupBy('p.payment_method')
            ->selectRaw('p.payment_method as method, COUNT(*) as payments, SUM(p.amount_paid) as total')
            ->orderByDesc('total')->get()
            ->map(fn ($m) => [
                'key'      => $m->method,
                'name'     => $methodNames[$m->method] ?? ucfirst(str_replace('_', ' ', (string) $m->method)),
                'payments' => (int) $m->payments,
                'total'    => (float) $m->total,
            ])->values();

        // Fee types: add up the lines of the challans these payments settled.
        $challanIds = (clone $base)->select('p.challan_id');
        $lines = DB::table('challan_items as ci')
            ->leftJoin('fee_structures as fs', 'fs.id', '=', 'ci.fee_structure_id')
            ->whereIn('ci.challan_id', $challanIds)
            ->groupBy('kind')
            ->selectRaw("CASE WHEN ci.type = 'late_fee' THEN '__late_fee' WHEN ci.type = 'discount' THEN '__discount' ELSE COALESCE(fs.fee_type, '__other') END as kind, SUM(ci.amount) as total, COUNT(DISTINCT ci.challan_id) as challans")
            ->get();

        $names = FeeType::pluck('name', 'slug');
        $special = ['__late_fee' => 'Late fee', '__discount' => 'Discounts', '__other' => 'Other charges'];
        $byFeeType = $lines->map(fn ($l) => [
            'key'      => $l->kind,
            'name'     => $special[$l->kind] ?? ($names[$l->kind] ?? ucfirst(str_replace('_', ' ', $l->kind))),
            'challans' => (int) $l->challans,
            'total'    => (float) $l->total,
        ])->sortByDesc('total')->values();

        // Older challans without line items: show the rest as one line so the parts add up.
        $rest = round($total - $byFeeType->sum('total'), 2);
        if (abs($rest) >= 1) {
            $byFeeType->push(['key' => '__unitemised', 'name' => 'Not itemised', 'challans' => null, 'total' => $rest]);
        }

        $byDay = (clone $base)
            ->groupBy('p.paid_at')
            ->selectRaw('p.paid_at as day, COUNT(*) as payments, SUM(p.amount_paid) as total')
            ->orderBy('p.paid_at')->get()
            ->map(fn ($d) => ['date' => Carbon::parse($d->day)->toDateString(), 'payments' => (int) $d->payments, 'total' => (float) $d->total])
            ->values();

        return [
            'total'       => $total,
            'payments'    => (int) ($totals->payments ?? 0),
            'students'    => (int) ($totals->students ?? 0),
            'by_method'   => $byMethod,
            'by_fee_type' => $byFeeType,
            'by_day'      => $byDay,
        ];
    }

    // College logo as a data URI for DomPDF (same lookup as the challan PDF).
    private function collegeLogoData(int $collegeId): ?string
    {
        $logo = \App\Models\Setting::where('college_id', $collegeId)->where('key', 'logo')->value('value');
        if (!$logo) return null;
        $urlPath = parse_url($logo, PHP_URL_PATH) ?: $logo;
        $pos     = strrpos($urlPath, '/storage/');
        $path    = ltrim($pos === false ? $urlPath : substr($urlPath, $pos + strlen('/storage/')), '/');
        $disk    = \Illuminate\Support\Facades\Storage::disk('public');
        if ($path === '' || !$disk->exists($path)) return null;
        $bytes = $disk->get($path);
        $mime  = class_exists(\finfo::class)
            ? ((new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: 'image/png')
            : (str_ends_with(strtolower($path), '.png') ? 'image/png' : 'image/jpeg');
        return 'data:' . $mime . ';base64,' . base64_encode($bytes);
    }
}
