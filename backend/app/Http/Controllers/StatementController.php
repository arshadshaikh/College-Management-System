<?php

namespace App\Http\Controllers;

use App\Models\Challan;
use App\Models\User;
use App\Services\ChallanService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Student fee statement: every challan (charge) and confirmed payment (credit) in
 * date order with a running balance, plus what is still owed.
 *
 *  - Cancelled and Rs. 0 challans are left out (a split challan's installments stand in for it).
 *  - "Confirmed" payments follow the Fee Collection rule: recorded by staff, or a slip
 *    that was approved. Slips still under review are listed apart and not credited.
 *  - Late fees on past-due challans are brought up to date first, so the balance
 *    matches what the student would pay today.
 */
class StatementController extends Controller
{
    public function __construct(private ChallanService $challanService) {}

    // GET /api/students/{student}/statement — admin
    public function show(User $student)
    {
        return response()->json($this->build($this->ownStudent($student)));
    }

    // GET /api/students/{student}/statement/pdf — admin
    public function pdf(Request $request, User $student)
    {
        return $this->pdfResponse($this->ownStudent($student), $request->user()->name);
    }

    // GET /api/my-statement — the logged-in student
    public function mine(Request $request)
    {
        return response()->json($this->build($this->self($request)));
    }

    // GET /api/my-statement/pdf — the logged-in student
    public function minePdf(Request $request)
    {
        $student = $this->self($request);
        return $this->pdfResponse($student, $student->name);
    }

    // ---------------------------------------------------------------------

    private function ownStudent(User $student): User
    {
        abort_if($student->college_id !== app('current_college')->id || $student->user_type !== 'student', 404, 'Student not found.');
        return $student;
    }

    private function self(Request $request): User
    {
        $user = $request->user();
        abort_if($user->college_id !== app('current_college')->id || $user->user_type !== 'student', 404, 'No fee statement for this account.');
        return $user;
    }

    private function build(User $student): array
    {
        $collegeId = app('current_college')->id;
        $today     = Carbon::today()->toDateString();

        // Bring late fees up to date on this student's past-due challans.
        Challan::where('college_id', $collegeId)->where('student_id', $student->id)
            ->whereIn('status', ['unpaid', 'overdue'])->whereDate('due_date', '<', $today)
            ->get()->each(fn ($c) => $this->challanService->applyLateFee($c));

        $challans = DB::table('challans as c')
            ->leftJoin('programs as p', 'p.id', '=', 'c.program_id')
            ->where('c.college_id', $collegeId)->where('c.student_id', $student->id)
            ->whereNull('c.deleted_at')->where('c.status', '!=', 'cancelled')
            ->where('c.total_amount', '!=', 0)   // Rs. 0 challans (nothing billed) are noise here
            ->orderBy('c.issue_date')->orderBy('c.id')
            ->get(['c.id', 'c.challan_no', 'c.title', 'c.challan_type', 'c.semester_no', 'c.installment_no',
                   'c.installments_count', 'c.total_amount', 'c.issue_date', 'c.due_date', 'c.status', 'p.scheme']);

        $payments = DB::table('payments as pm')
            ->join('challans as c', 'c.id', '=', 'pm.challan_id')
            ->where('pm.college_id', $collegeId)->where('pm.student_id', $student->id)
            ->whereNull('c.deleted_at')->where('c.status', '!=', 'cancelled')
            ->orderBy('pm.paid_at')->orderBy('pm.id')
            ->get(['pm.id', 'pm.amount_paid', 'pm.payment_method', 'pm.payment_reference', 'pm.paid_at', 'pm.slip_status',
                   'c.id as challan_id', 'c.challan_no']);

        $confirmed = $payments->filter(fn ($p) => $p->slip_status === null || $p->slip_status === 'approved');
        $pending   = $payments->where('slip_status', 'pending')->values();

        // Ledger: charges and credits by date; on the same day the charge comes first.
        $entries = collect();
        foreach ($challans as $c) {
            $entries->push(['sort' => [$this->day($c->issue_date), 0, $c->id], 'row' => [
                'type' => 'charge', 'date' => $this->day($c->issue_date), 'challan_id' => $c->id, 'challan_no' => $c->challan_no,
                'description' => $this->describe($c), 'due_date' => $this->day($c->due_date), 'status' => $c->status,
                'debit' => (float) $c->total_amount, 'credit' => 0.0,
            ]]);
        }
        foreach ($confirmed as $p) {
            $entries->push(['sort' => [$this->day($p->paid_at), 1, $p->id], 'row' => [
                'type' => 'payment', 'date' => $this->day($p->paid_at), 'challan_id' => $p->challan_id, 'challan_no' => $p->challan_no,
                'description' => 'Payment · ' . $this->method($p->payment_method) . ($p->payment_reference ? " · {$p->payment_reference}" : ''),
                'debit' => 0.0, 'credit' => (float) $p->amount_paid,
            ]]);
        }
        $balance = 0.0;
        $ledger = $entries->sortBy([fn ($a, $b) => $a['sort'] <=> $b['sort']])->values()
            ->map(function ($e) use (&$balance) {
                $balance = round($balance + $e['row']['debit'] - $e['row']['credit'], 2);
                return $e['row'] + ['balance' => $balance];
            });

        $open    = $challans->whereIn('status', ['unpaid', 'overdue']);
        $overdue = $open->filter(fn ($c) => $this->day($c->due_date) < $today);
        $next    = $open->filter(fn ($c) => $this->day($c->due_date) >= $today)->sortBy('due_date')->first();

        return [
            'college' => ['name' => app('current_college')->name],
            'student' => $this->studentInfo($student),
            'as_of'   => $today,
            'summary' => [
                'billed'        => round($challans->sum(fn ($c) => (float) $c->total_amount), 2),
                'paid'          => round($confirmed->sum(fn ($p) => (float) $p->amount_paid), 2),
                'balance'       => $balance,
                'outstanding'   => round($open->sum(fn ($c) => (float) $c->total_amount), 2),
                'open_count'    => $open->count(),
                'overdue'       => round($overdue->sum(fn ($c) => (float) $c->total_amount), 2),
                'overdue_count' => $overdue->count(),
                'pending_slips' => round($pending->sum(fn ($p) => (float) $p->amount_paid), 2),
                'next_due'      => $next ? ['challan_id' => $next->id, 'challan_no' => $next->challan_no,
                                            'amount' => (float) $next->total_amount, 'due_date' => $this->day($next->due_date)] : null,
            ],
            'ledger'  => $ledger,
            'open'    => $open->sortBy('due_date')->values()->map(fn ($c) => [
                'challan_id' => $c->id, 'challan_no' => $c->challan_no, 'description' => $this->describe($c),
                'amount' => (float) $c->total_amount, 'due_date' => $this->day($c->due_date),
                'overdue' => $this->day($c->due_date) < $today,
            ]),
            'pending' => $pending->map(fn ($p) => [
                'challan_id' => $p->challan_id, 'challan_no' => $p->challan_no, 'amount' => (float) $p->amount_paid,
                'paid_at' => $this->day($p->paid_at), 'method' => $this->method($p->payment_method),
            ]),
        ];
    }

    private function studentInfo(User $student): array
    {
        $profile = DB::table('student_profiles')->where('user_id', $student->id)->whereNull('deleted_at')->first(['father_name']);
        $app = DB::table('applications as a')->join('programs as p', 'p.id', '=', 'a.program_id')
            ->where('a.student_id', $student->id)->where('a.college_id', app('current_college')->id)
            ->whereNull('a.deleted_at')->where('a.status', 'approved')
            ->orderByDesc('a.id')->first(['p.name as program', 'a.admission_year', 'a.shift']);

        return [
            'id' => $student->id, 'name' => $student->name, 'cnic_no' => $student->cnic_no,
            'father_name' => $profile->father_name ?? null, 'email' => $student->email, 'phone' => $student->phone,
            'program' => $app->program ?? null, 'batch' => $app->admission_year ?? null, 'shift' => $app->shift ?? null,
        ];
    }

    private function describe(object $c): string
    {
        if ($c->title) return $c->title;
        $text = ucfirst($c->challan_type) . ' fee';
        if ($c->semester_no) $text .= ' · ' . ($c->scheme === 'annual' ? 'Part' : 'Semester') . " {$c->semester_no}";
        if ($c->installment_no && $c->installments_count) $text .= " · Installment {$c->installment_no} of {$c->installments_count}";
        return $text;
    }

    private function method(?string $m): string
    {
        return ['cash' => 'Cash', 'bank_transfer' => 'Bank deposit', 'online' => 'Online'][$m] ?? (string) $m;
    }

    private function day($value): string
    {
        return substr((string) $value, 0, 10);
    }

    private function pdfResponse(User $student, string $generatedBy)
    {
        $data = $this->build($student);
        $college = app('current_college');

        $pdf = Pdf::loadView('reports.statement', $data + [
            'collegeModel' => $college,
            'generatedBy'  => $generatedBy,
            'logoData'     => $this->collegeLogoData($college->id),
        ])->setPaper('a4', 'portrait');

        return $pdf->download('fee-statement-' . $student->cnic_no . '.pdf');
    }

    // Same as ReportController: the college logo inlined so DomPDF needs no web request.
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
