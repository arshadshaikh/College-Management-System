<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: 0; }
        body { font-family: DejaVu Sans, sans-serif; color: #1a1a1a; }

        /* Landscape A4 ≈ 297mm x 210mm. Four columns, each ~72mm, gaps between. */
        .copy {
            position: absolute;
            top: 6mm;
            width: 68mm;
            font-size: 8px;
            border: 0.5pt solid #000;
            padding: 3mm 2.5mm;
        }
        .copy.c0 { left: 4mm; }
        .copy.c1 { left: 76mm; }
        .copy.c2 { left: 148mm; }
        .copy.c3 { left: 220mm; }

        .copy-label { font-size: 8px; font-weight: bold; text-transform: uppercase;
                      text-align: center; margin-bottom: 3mm; letter-spacing: 0.3px; }

        .head { text-align: center; margin-bottom: 2mm; }
        .head img.logo { max-width: 20mm; max-height: 14mm; margin-bottom: 1mm; }
        .head .cname { font-size: 9.5px; font-weight: bold; }
        .head .cmeta { font-size: 6.5px; color: #444; }

        .idbox { border: 0.5pt solid #000; text-align: center; margin: 2mm 0; }
        .idbox .idlabel { font-weight: bold; font-size: 9px; border-bottom: 0.5pt solid #000; padding: 1mm; }
        .idbox .idval { font-weight: bold; font-size: 10px; padding: 1mm; border-bottom: 0.5pt solid #000; letter-spacing: 0.5px; }
        .idbox .chrow { display: table; width: 100%; }
        .idbox .chrow .cl { display: table-cell; text-align: left; padding: 1mm 2mm; font-size: 7.5px; border-right: 0.5pt solid #000; }
        .idbox .chrow .cv { display: table-cell; text-align: left; padding: 1mm 2mm; font-size: 7.5px; }

        .validity { text-align: center; color: #c00; font-weight: bold; font-size: 7.5px; margin: 2mm 0; }

        .titlebar { background: #000; color: #fff; text-align: center; font-weight: bold;
                    font-size: 8px; padding: 1.2mm; margin-bottom: 2mm; }

        .field { font-size: 7.5px; margin-bottom: 1.5mm; }
        .field .fl { color: #333; }
        .field .fv { font-weight: bold; display: block; }

        table.items { width: 100%; border-collapse: collapse; margin: 2mm 0; }
        table.items th { border: 0.5pt solid #000; padding: 1.2mm; font-size: 7.5px; text-align: left; font-weight: bold; }
        table.items td { border: 0.5pt solid #000; padding: 1.2mm; font-size: 7.5px; }
        table.items td.amt, table.items th.amt { text-align: right; }
        table.items tr.discount td { color: #060; }
        table.items tr.total td { font-weight: bold; }

        .words { font-size: 7px; margin: 1.5mm 0; }
        .words b { }

        .note { font-size: 6px; line-height: 1.35; border: 0.5pt solid #000; padding: 1.5mm; margin-top: 1.5mm; }
        .note .nt { text-align: center; font-weight: bold; display: block; margin-bottom: 0.8mm; }

        .foot { font-size: 5.5px; color: #666; text-align: center; margin-top: 1.5mm; }
    </style>
</head>
<body>

@php
    $items = $challan->items && $challan->items->count()
        ? $challan->items->map(fn($i) => ['label' => $i->label, 'amount' => (float) $i->amount, 'type' => $i->type])->all()
        : collect($challan->fee_breakdown ?? [])->map(fn($f) => ['label' => $f['label'], 'amount' => (float) $f['amount'], 'type' => 'fee'])->all();

    $copies = ["Bank's Copy", "Account's Copy", "Office Copy", "Student's Copy"];

    $toWords = function ($n) {
        $n = (int) round($n);
        if ($n == 0) return 'Zero';
        $ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
        $tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
        $three = function ($num) use ($ones, $tens) {
            $s = '';
            if ($num >= 100) { $s .= $ones[intdiv($num,100)].' Hundred '; $num %= 100; }
            if ($num >= 20) { $s .= $tens[intdiv($num,10)].' '; $num %= 10; }
            if ($num > 0) { $s .= $ones[$num].' '; }
            return $s;
        };
        $out = '';
        if ($n >= 10000000) { $out .= $three(intdiv($n,10000000)).'Crore '; $n %= 10000000; }
        if ($n >= 100000)   { $out .= $three(intdiv($n,100000)).'Lac '; $n %= 100000; }
        if ($n >= 1000)     { $out .= $three(intdiv($n,1000)).'Thousand '; $n %= 1000; }
        if ($n > 0)         { $out .= $three($n); }
        return trim(preg_replace('/\s+/', ' ', $out));
    };
    $amountWords = strtoupper($toWords($challan->total_amount)).' RUPEES ONLY';

    $renderCopy = function ($copyLabel, $idx) use ($challan, $college, $student, $program, $items, $amountWords, $logoData) {
        ob_start(); ?>
        <div class="copy c<?= $idx ?>">
            <div class="copy-label"><?= $copyLabel ?></div>
            <div class="head">
                <?php if ($logoData): ?><img class="logo" src="<?= $logoData ?>" alt=""><?php endif; ?>
                <div class="cname"><?= e($college->name) ?></div>
                <div class="cmeta"><?= e($college->city ?? '') ?></div>
            </div>

            <div class="idbox">
                <div class="idlabel">CHALLAN</div>
                <div class="idval"><?= e($challan->challan_no) ?></div>
                <div class="chrow"><span class="cl">Issue Date</span><span class="cv"><?= $challan->issue_date->format('d-m-Y') ?></span></div>
                <?php if ($challan->installment_no): ?>
                <div class="chrow"><span class="cl">Installment</span><span class="cv"><?= $challan->installment_no ?></span></div>
                <?php endif; ?>
            </div>

            <div class="validity">Valid upto: <?= $challan->due_date->format('d-m-Y') ?></div>

            <div class="titlebar"><?= e(strtoupper($challan->title ?? ($challan->challan_type.' FEE'))) ?></div>

            <div class="field"><span class="fl">Candidate Name:</span><span class="fv"><?= e($student->name) ?></span></div>
            <div class="field"><span class="fl">CNIC:</span><span class="fv"><?= e($student->cnic_no) ?></span></div>
            <div class="field"><span class="fl">Program:</span><span class="fv"><?= e($program->name) ?><?= $program->code ? ' ('.e($program->code).')' : '' ?></span></div>
            <div class="field"><span class="fl">Application:</span><span class="fv"><?= e($challan->application->application_no) ?></span></div>

            <table class="items">
                <thead><tr><th>Purpose of Payment</th><th class="amt">Amount (Rs.)</th></tr></thead>
                <tbody>
                    <?php foreach ($items as $it): ?>
                    <tr class="<?= $it['type'] === 'discount' ? 'discount' : '' ?>">
                        <td><?= e($it['label']) ?></td>
                        <td class="amt"><?= $it['amount'] < 0 ? '('.number_format(abs($it['amount']),2).')' : number_format($it['amount'],2) ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
                <tfoot><tr class="total"><td>Total</td><td class="amt">Rs. <?= number_format($challan->total_amount, 2) ?></td></tr></tfoot>
            </table>

            <div class="words"><b>Amount in words:</b> <?= e($amountWords) ?></div>

            <div class="note">
                <span class="nt">IMPORTANT NOTE</span>
                This paid amount (Rs. <?= number_format($challan->total_amount, 2) ?>/=) is non-transferable and
                non-refundable. In case any applicant provided wrong information (detected at any stage), admission
                shall be cancelled. <?= e($college->name) ?> reserves the right to rectify any error / omission.
            </div>

            <div class="foot">Generated <?= now()->format('d-m-Y H:i') ?></div>
        </div>
        <?php return ob_get_clean();
    };

    foreach ($copies as $i => $label) {
        echo $renderCopy($label, $i);
    }
@endphp

</body>
</html>