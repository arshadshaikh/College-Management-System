<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Payment slips get a clear state: pending | approved | rejected (null = no slip review,
 * e.g. cash recorded by the admin). Before this, a rejected slip looked "verified".
 * slip_remarks holds the reason a slip was rejected, shown to the student.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('slip_status', 20)->nullable()->after('slip_verified_at');
            $table->string('slip_remarks', 500)->nullable()->after('slip_status');
            $table->index(['college_id', 'slip_status']);
        });

        // Backfill from the old flags.
        DB::table('payments')->where('slip_verified', false)->whereNotNull('slip_path')
            ->update(['slip_status' => 'pending']);

        DB::table('payments')->where('slip_verified', true)
            ->whereIn('challan_id', DB::table('challans')->where('status', 'paid')->select('id'))
            ->update(['slip_status' => 'approved']);

        DB::table('payments')->where('slip_verified', true)->whereNull('slip_status')
            ->update(['slip_status' => 'rejected']);
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['college_id', 'slip_status']);
            $table->dropColumn(['slip_status', 'slip_remarks']);
        });
    }
};
