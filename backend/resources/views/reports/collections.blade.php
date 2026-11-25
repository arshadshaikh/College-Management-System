@php
    $rs = fn ($n) => 'Rs. ' . number_format((float) $n, 0);
    $period = $from->equalTo($to)
        ? $from->format('l, j F Y')
        : $from->format('j M Y') . ' to ' . $to->format('j M Y');
    $methodNames = ['cash' => 'Cash', 'bank_transfer' => 'Bank deposit', 'online' => 'Online'];
    $maxType = max(1, collect($summary['by_fee_type'])->max(fn ($t) => abs($t['total'])) ?? 1);
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page { margin: 14mm 12mm 16mm 12mm; }
    body { font-family: DejaVu Sans, sans-serif; color: #1f2937; font-size: 9px; }
    .header { border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-bottom: 12px; }
    .header table { width: 100%; }
    .logo { max-height: 42px; max-width: 60px; }
    .cname { font-size: 15px; font-weight: bold; color: #111827; }
    .title { font-size: 11px; color: #4f46e5; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }
    .muted { color: #6b7280; }
    .period { font-size: 10px; text-align: right; }
    .cards { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 -6px 12px; }
    .card { background: #f5f7ff; border: 1px solid #e0e7ff; border-radius: 6px; padding: 8px 10px; }
    .card .lbl { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
    .card .val { font-size: 15px; font-weight: bold; color: #111827; margin-top: 2px; }
    .card.main { background: #4f46e5; border-color: #4f46e5; }
    .card.main .lbl { color: #c7d2fe; }
    .card.main .val { color: #ffffff; }
    h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin: 0 0 6px; }
    .two { width: 100%; margin-bottom: 12px; }
    .two td.col { width: 50%; vertical-align: top; padding-right: 8px; }
    .two td.col + td.col { padding-right: 0; padding-left: 8px; }
    table.list { width: 100%; border-collapse: collapse; }
    table.list th { background: #f3f4f6; text-align: left; font-size: 8px; text-transform: uppercase; color: #4b5563; padding: 5px 6px; border-bottom: 1px solid #d1d5db; }
    table.list td { padding: 4px 6px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
    table.list tr.total td { border-top: 1.5px solid #111827; border-bottom: none; font-weight: bold; font-size: 10px; }
    .r { text-align: right; }
    .bar { height: 5px; background: #6366f1; border-radius: 2px; }
    .bar.neg { background: #f87171; }
    .footer { position: fixed; bottom: -10mm; left: 0; right: 0; font-size: 7.5px; color: #9ca3af; }
    .sign { margin-top: 26px; width: 100%; }
    .sign td { width: 33%; padding-top: 22px; }
    .sign .line { border-top: 1px solid #9ca3af; width: 80%; padding-top: 3px; font-size: 8px; color: #6b7280; }
    .empty { padding: 18px; text-align: center; color: #6b7280; border: 1px dashed #d1d5db; border-radius: 6px; }
</style>
</head>
<body>

<div class="footer">
    Generated {{ now()->setTimezone(config('app.display_timezone', 'Asia/Karachi'))->format('j M Y, g:i A') }} by {{ $generatedBy }}. Counts payments recorded by staff and student slips that were approved. Pending and rejected slips are not included.
</div>

<div class="header">
    <table><tr>
        @if($logoData)<td style="width:66px;"><img class="logo" src="{{ $logoData }}"></td>@endif
        <td>
            <div class="cname">{{ $college->name }}</div>
            <div class="title">Fee Collection Report</div>
        </td>
        <td class="period">
            <div><strong>{{ $period }}</strong></div>
            <div class="muted">
                {{ $program ? $program->name : 'All programs' }} ·
                {{ $method ? ($methodNames[$method] ?? $method) : 'All payment methods' }}
                @if($search) · “{{ $search }}” @endif
            </div>
        </td>
    </tr></table>
</div>

<table class="cards"><tr>
    <td class="card main" style="width:40%"><div class="lbl">Total collected</div><div class="val">{{ $rs($summary['total']) }}</div></td>
    <td class="card"><div class="lbl">Payments</div><div class="val">{{ number_format($summary['payments']) }}</div></td>
    <td class="card"><div class="lbl">Students</div><div class="val">{{ number_format($summary['students']) }}</div></td>
</tr></table>

@if($summary['payments'] === 0)
    <div class="empty">No fee was collected in this period.</div>
@else
<table class="two"><tr>
    <td class="col">
        <h2>By fee type</h2>
        <table class="list">
            @foreach($summary['by_fee_type'] as $t)
            <tr>
                <td style="width:38%">{{ $t['name'] }}</td>
                <td style="width:34%"><div class="bar {{ $t['total'] < 0 ? 'neg' : '' }}" style="width: {{ max(2, round(abs($t['total']) / $maxType * 100)) }}%"></div></td>
                <td class="r">{{ $rs($t['total']) }}</td>
            </tr>
            @endforeach
            <tr class="total"><td colspan="2">Total</td><td class="r">{{ $rs($summary['total']) }}</td></tr>
        </table>
    </td>
    <td class="col">
        <h2>By payment method</h2>
        <table class="list">
            <tr><th>Method</th><th class="r">Payments</th><th class="r">Amount</th></tr>
            @foreach($summary['by_method'] as $m)
            <tr><td>{{ $m['name'] }}</td><td class="r">{{ $m['payments'] }}</td><td class="r">{{ $rs($m['total']) }}</td></tr>
            @endforeach
        </table>
        @if(count($summary['by_day']) > 1)
        <h2 style="margin-top:10px;">By day</h2>
        <table class="list">
            <tr><th>Date</th><th class="r">Payments</th><th class="r">Amount</th></tr>
            @foreach($summary['by_day'] as $d)
            <tr><td>{{ \Illuminate\Support\Carbon::parse($d['date'])->format('D, j M Y') }}</td><td class="r">{{ $d['payments'] }}</td><td class="r">{{ $rs($d['total']) }}</td></tr>
            @endforeach
        </table>
        @endif
    </td>
</tr></table>

<h2>Payments</h2>
<table class="list">
    <thead><tr>
        <th>#</th><th>Date</th><th>Challan</th><th>Student</th><th>Program</th><th>Method / Ref.</th><th>Received by</th><th class="r">Amount</th>
    </tr></thead>
    <tbody>
    @foreach($rows as $i => $r)
        <tr>
            <td class="muted">{{ $i + 1 }}</td>
            <td>{{ \Illuminate\Support\Carbon::parse($r->paid_at)->format('j M Y') }}</td>
            <td>{{ $r->challan_no }}<div class="muted">{{ $r->title }}</div></td>
            <td>{{ $r->name }}<div class="muted">{{ $r->cnic_no }}</div></td>
            <td>{{ $r->program['code'] ?? ($r->program['name'] ?? '—') }}@if($r->semester_no && $r->program) {{ ($r->program['scheme'] ?? '') === 'annual' ? 'Part' : 'Sem' }} {{ $r->semester_no }}@endif</td>
            <td>{{ $methodNames[$r->payment_method] ?? $r->payment_method }}@if($r->payment_reference)<div class="muted">{{ $r->payment_reference }}</div>@endif</td>
            <td>{{ $r->received_by ?? '—' }}<div class="muted">{{ $r->source === 'slip' ? 'Slip approved' : 'Recorded' }}</div></td>
            <td class="r">{{ $rs($r->amount_paid) }}</td>
        </tr>
    @endforeach
        <tr class="total"><td colspan="7">Total ({{ number_format($summary['payments']) }} payments)</td><td class="r">{{ $rs($summary['total']) }}</td></tr>
    </tbody>
</table>
@if($rows->count() < $summary['payments'])
    <p class="muted" style="margin-top:6px;">Showing the first {{ $rows->count() }} payments. Narrow the dates to print the rest.</p>
@endif
@endif

<table class="sign"><tr>
    <td><div class="line">Prepared by</div></td>
    <td><div class="line">Accounts Officer</div></td>
    <td><div class="line">Checked by</div></td>
</tr></table>

</body>
</html>
