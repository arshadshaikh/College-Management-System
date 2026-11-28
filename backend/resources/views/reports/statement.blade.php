@php
    $rs  = fn ($n) => 'Rs. ' . number_format((float) $n, 0);
    $day = fn ($d) => \Illuminate\Support\Carbon::parse($d)->format('j M Y');
    $s   = $summary;
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page { margin: 14mm 12mm 16mm 12mm; }
    body { font-family: DejaVu Sans, sans-serif; color: #1f2937; font-size: 9px; }
    .header { border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-bottom: 10px; }
    .header table { width: 100%; }
    .logo { max-height: 42px; max-width: 60px; }
    .cname { font-size: 15px; font-weight: bold; color: #111827; }
    .title { font-size: 11px; color: #4f46e5; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }
    .muted { color: #6b7280; }
    .asof { font-size: 10px; text-align: right; }
    .who { width: 100%; margin-bottom: 10px; border-collapse: collapse; }
    .who td { padding: 2px 0; vertical-align: top; }
    .who .k { color: #6b7280; width: 70px; }
    .cards { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 -6px 12px; }
    .card { background: #f5f7ff; border: 1px solid #e0e7ff; border-radius: 6px; padding: 8px 10px; }
    .card .lbl { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
    .card .val { font-size: 14px; font-weight: bold; color: #111827; margin-top: 2px; }
    .card.main { background: #4f46e5; border-color: #4f46e5; }
    .card.main .lbl { color: #c7d2fe; }
    .card.main .val { color: #ffffff; }
    .card.clear { background: #ecfdf5; border-color: #a7f3d0; }
    .red, .card .val.red { color: #b91c1c; }
    h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin: 12px 0 6px; }
    table.list { width: 100%; border-collapse: collapse; }
    table.list th { background: #f3f4f6; text-align: left; font-size: 8px; text-transform: uppercase; color: #4b5563; padding: 5px 6px; border-bottom: 1px solid #d1d5db; }
    table.list td { padding: 4px 6px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
    table.list tr.pay td { background: #f8fffb; }
    table.list tr.total td { border-top: 1.5px solid #111827; border-bottom: none; font-weight: bold; font-size: 10px; }
    .r { text-align: right; }
    .pill { font-size: 7.5px; padding: 1px 5px; border-radius: 8px; background: #f3f4f6; color: #4b5563; }
    .pill.paid { background: #dcfce7; color: #166534; }
    .pill.overdue { background: #fee2e2; color: #991b1b; }
    .pill.unpaid { background: #fef3c7; color: #92400e; }
    .footer { position: fixed; bottom: -10mm; left: 0; right: 0; font-size: 7.5px; color: #9ca3af; }
    .empty { padding: 18px; text-align: center; color: #6b7280; border: 1px dashed #d1d5db; border-radius: 6px; }
    .note { margin-top: 8px; padding: 6px 8px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; color: #92400e; }
</style>
</head>
<body>

<div class="footer">
    Generated {{ now()->format('j M Y, g:i A') }} by {{ $generatedBy }}. Payments are counted once recorded by the accounts office or once an uploaded slip is approved. Cancelled challans are not shown.
</div>

<div class="header">
    <table><tr>
        @if($logoData)<td style="width:66px;"><img class="logo" src="{{ $logoData }}"></td>@endif
        <td>
            <div class="cname">{{ $collegeModel->name }}</div>
            <div class="title">Student Fee Statement</div>
        </td>
        <td class="asof"><div><strong>As of {{ $day($as_of) }}</strong></div></td>
    </tr></table>
</div>

<table class="who"><tr>
    <td style="width:50%">
        <table>
            <tr><td class="k">Student</td><td><strong>{{ $student['name'] }}</strong></td></tr>
            <tr><td class="k">Father</td><td>{{ $student['father_name'] ?? '—' }}</td></tr>
            <tr><td class="k">CNIC</td><td>{{ $student['cnic_no'] }}</td></tr>
        </table>
    </td>
    <td>
        <table>
            <tr><td class="k">Program</td><td>{{ $student['program'] ?? 'Not enrolled' }}</td></tr>
            <tr><td class="k">Batch</td><td>{{ $student['batch'] ?? '—' }}@if($student['shift']) · {{ ucfirst($student['shift']) }}@endif</td></tr>
            <tr><td class="k">Contact</td><td>{{ collect([$student['phone'], $student['email']])->filter()->implode(' · ') ?: '—' }}</td></tr>
        </table>
    </td>
</tr></table>

<table class="cards"><tr>
    <td class="card {{ $s['outstanding'] > 0 ? 'main' : 'clear' }}" style="width:34%">
        <div class="lbl">Balance due</div>
        <div class="val">{{ $rs($s['outstanding']) }}</div>
        <div class="{{ $s['outstanding'] > 0 ? '' : 'muted' }}" style="font-size:8px; {{ $s['outstanding'] > 0 ? 'color:#c7d2fe' : '' }}">
            {{ $s['outstanding'] > 0 ? $s['open_count'] . ' unpaid challan' . ($s['open_count'] === 1 ? '' : 's') : 'Nothing to pay' }}
        </div>
    </td>
    <td class="card"><div class="lbl">Total billed</div><div class="val">{{ $rs($s['billed']) }}</div></td>
    <td class="card"><div class="lbl">Total paid</div><div class="val">{{ $rs($s['paid']) }}</div></td>
    <td class="card"><div class="lbl">Overdue</div><div class="val {{ $s['overdue'] > 0 ? 'red' : '' }}">{{ $rs($s['overdue']) }}</div></td>
</tr></table>

@if(count($open))
<h2>To pay</h2>
<table class="list">
    <tr><th>Challan</th><th>For</th><th>Due date</th><th class="r">Amount</th></tr>
    @foreach($open as $o)
    <tr>
        <td>{{ $o['challan_no'] }}</td>
        <td>{{ $o['description'] }}</td>
        <td class="{{ $o['overdue'] ? 'red' : '' }}">{{ $day($o['due_date']) }}@if($o['overdue']) (overdue)@endif</td>
        <td class="r">{{ $rs($o['amount']) }}</td>
    </tr>
    @endforeach
    <tr class="total"><td colspan="3">Balance due</td><td class="r">{{ $rs($s['outstanding']) }}</td></tr>
</table>
@endif

<h2>Statement of account</h2>
@if(count($ledger) === 0)
    <div class="empty">No challans have been issued to this student yet.</div>
@else
<table class="list">
    <thead><tr><th style="width:62px">Date</th><th>Particulars</th><th style="width:78px">Challan</th><th class="r" style="width:62px">Charged</th><th class="r" style="width:62px">Paid</th><th class="r" style="width:66px">Balance</th></tr></thead>
    <tbody>
    @foreach($ledger as $e)
        <tr class="{{ $e['type'] === 'payment' ? 'pay' : '' }}">
            <td>{{ $day($e['date']) }}</td>
            <td>{{ $e['description'] }}
                @if($e['type'] === 'charge')<div class="muted">Due {{ $day($e['due_date']) }} <span class="pill {{ $e['status'] }}">{{ ucfirst($e['status']) }}</span></div>@endif
            </td>
            <td>{{ $e['challan_no'] }}</td>
            <td class="r">{{ $e['debit'] ? $rs($e['debit']) : '' }}</td>
            <td class="r">{{ $e['credit'] ? $rs($e['credit']) : '' }}</td>
            <td class="r">{{ $rs($e['balance']) }}</td>
        </tr>
    @endforeach
        <tr class="total"><td colspan="3">Totals</td><td class="r">{{ $rs($s['billed']) }}</td><td class="r">{{ $rs($s['paid']) }}</td><td class="r">{{ $rs($s['balance']) }}</td></tr>
    </tbody>
</table>
@endif

@if($s['pending_slips'] > 0)
    <div class="note">{{ $rs($s['pending_slips']) }} in uploaded payment slips is waiting for verification and is not counted above yet.</div>
@endif

</body>
</html>
