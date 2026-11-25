<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Challans made before line items existed only have the old fee_breakdown snapshot.
 * When such a challan went past its due date, opening it added a Late Fee line, and
 * from then on the page showed ONLY the late fee and the total became just the late
 * fee. This copies the old breakdown into real lines for every challan that has no
 * fee line yet. Unpaid / overdue totals are recomputed (fee lines + late fee);
 * paid and cancelled challans keep the total they were settled at.
 * Safe to run again: challans that already have fee lines are skipped.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('challans')->whereNotNull('fee_breakdown')->orderBy('id')
            ->chunkById(200, function ($challans) use ($now) {
                foreach ($challans as $c) {
                    $hasFeeLines = DB::table('challan_items')->where('challan_id', $c->id)
                        ->where('type', '!=', 'late_fee')->exists();
                    if ($hasFeeLines) {
                        continue;
                    }

                    $lines = collect(json_decode($c->fee_breakdown, true) ?: [])
                        ->filter(fn ($l) => isset($l['amount']) && (float) $l['amount'] != 0.0)->values();
                    if ($lines->isEmpty()) {
                        continue;
                    }

                    foreach ($lines as $i => $l) {
                        DB::table('challan_items')->insert([
                            'challan_id' => $c->id,
                            'label'      => (string) ($l['label'] ?? 'Fee'),
                            'amount'     => (float) $l['amount'],
                            'type'       => (float) $l['amount'] < 0 ? 'discount' : 'fee',
                            'sort_order' => $i,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }

                    if (in_array($c->status, ['unpaid', 'overdue'], true)) {
                        DB::table('challans')->where('id', $c->id)->update([
                            'total_amount' => DB::table('challan_items')->where('challan_id', $c->id)->sum('amount'),
                            'updated_at'   => $now,
                        ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Nothing to undo safely: the copied lines are now the challan's real lines.
    }
};
