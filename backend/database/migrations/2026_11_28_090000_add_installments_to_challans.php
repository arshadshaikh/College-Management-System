<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Installments: a challan can be split into 2+ challans. Each part points back
 * to the challan it was split from (that one is cancelled) and knows how many
 * parts there are ("Installment 2 of 3").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('challans', function (Blueprint $table) {
            $table->foreignId('parent_challan_id')->nullable()->after('installment_no')
                  ->constrained('challans')->nullOnDelete();
            $table->unsignedTinyInteger('installments_count')->nullable()->after('parent_challan_id');
        });
    }

    public function down(): void
    {
        Schema::table('challans', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_challan_id');
            $table->dropColumn('installments_count');
        });
    }
};
