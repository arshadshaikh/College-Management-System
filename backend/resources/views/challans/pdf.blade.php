<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1a1a1a; }

        .header { text-align: center; padding: 20px; border-bottom: 3px solid #1e40af; margin-bottom: 20px; }
        .header h1 { font-size: 22px; color: #1e40af; margin-bottom: 4px; }
        .header p  { font-size: 11px; color: #555; }

        .challan-title { text-align: center; font-size: 16px; font-weight: bold;
                         background: #1e40af; color: white; padding: 8px; margin-bottom: 20px; }

        .section       { margin-bottom: 16px; }
        .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase;
                         letter-spacing: 0.5px; color: #1e40af; border-bottom: 1px solid #ddd;
                         padding-bottom: 4px; margin-bottom: 8px; }

        .row           { display: flex; margin-bottom: 5px; }
        .label         { width: 160px; color: #555; font-size: 11px; }
        .value         { font-weight: bold; font-size: 11px; }

        table          { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th             { background: #f1f5f9; text-align: left; padding: 7px 10px;
                         font-size: 11px; border: 1px solid #ddd; }
        td             { padding: 7px 10px; font-size: 11px; border: 1px solid #ddd; }
        .amount        { text-align: right; }
        .total-row td  { font-weight: bold; background: #f8fafc; }

        .status-badge  { display: inline-block; padding: 4px 12px; border-radius: 4px;
                         font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .status-unpaid { background: #fef3c7; color: #92400e; }
        .status-paid   { background: #d1fae5; color: #065f46; }
        .status-overdue{ background: #fee2e2; color: #991b1b; }

        .footer        { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 12px;
                         font-size: 10px; color: #777; text-align: center; }

        .due-box       { border: 2px dashed #1e40af; padding: 10px; text-align: center;
                         margin: 16px 0; border-radius: 4px; }
        .due-box .amount-large { font-size: 24px; font-weight: bold; color: #1e40af; }
    </style>
</head>
<body>

<!-- Header -->
<div class="header">
    <h1>{{ $college->name }}</h1>
    <p>{{ $college->address ?? '' }} {{ $college->city ? '· ' . $college->city : '' }}</p>
    <p>{{ $college->email }} {{ $college->phone ? '· ' . $college->phone : '' }}</p>
</div>

<div class="challan-title">
    {{ strtoupper($challan->challan_type) }} FEE CHALLAN
</div>

<!-- Challan meta -->
<div class="section">
    <div class="section-title">Challan Information</div>
    <div class="row">
        <span class="label">Challan No:</span>
        <span class="value">{{ $challan->challan_no }}</span>
    </div>
    <div class="row">
        <span class="label">Issue Date:</span>
        <span class="value">{{ $challan->issue_date->format('d M Y') }}</span>
    </div>
    <div class="row">
        <span class="label">Due Date:</span>
        <span class="value">{{ $challan->due_date->format('d M Y') }}</span>
    </div>
    <div class="row">
        <span class="label">Status:</span>
        <span class="value">
            <span class="status-badge status-{{ $challan->status }}">{{ $challan->status }}</span>
        </span>
    </div>
    @if($challan->semester_no)
    <div class="row">
        <span class="label">Semester:</span>
        <span class="value">{{ $challan->semester_no }}</span>
    </div>
    @endif
</div>

<!-- Student info -->
<div class="section">
    <div class="section-title">Student Information</div>
    <div class="row">
        <span class="label">Name:</span>
        <span class="value">{{ $student->name }}</span>
    </div>
    <div class="row">
        <span class="label">CNIC:</span>
        <span class="value">{{ $student->cnic_no }}</span>
    </div>
    <div class="row">
        <span class="label">Program:</span>
        <span class="value">{{ $program->name }} ({{ $program->code }})</span>
    </div>
    <div class="row">
        <span class="label">Application No:</span>
        <span class="value">{{ $challan->application->application_no }}</span>
    </div>
</div>

<!-- Fee breakdown -->
<div class="section">
    <div class="section-title">Fee Breakdown</div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Description</th>
                <th class="amount">Amount (PKR)</th>
            </tr>
        </thead>
        <tbody>
            @foreach($challan->fee_breakdown as $i => $item)
            <tr>
                <td>{{ $i + 1 }}</td>
                <td>{{ $item['label'] }}</td>
                <td class="amount">{{ number_format($item['amount'], 2) }}</td>
            </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="2">Total Amount</td>
                <td class="amount">PKR {{ number_format($challan->total_amount, 2) }}</td>
            </tr>
        </tfoot>
    </table>
</div>

<!-- Amount due box -->
<div class="due-box">
    <div>Total Payable Amount</div>
    <div class="amount-large">PKR {{ number_format($challan->total_amount, 2) }}</div>
    <div>Pay before: <strong>{{ $challan->due_date->format('d M Y') }}</strong></div>
</div>

<div class="footer">
    This is a system-generated challan. Please keep this for your records.<br>
    {{ $college->name }} — {{ now()->format('d M Y H:i') }}
</div>

</body>
</html>