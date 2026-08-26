<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1) New line-item table. A challan now HAS MANY items; each item is one
        //    printed line on the challan (a fee, a discount, a late fee, or a
        //    conditional/manual charge). The challan's total_amount is the SUM of
        //    these items' amounts.
        Schema::create('challan_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('challan_id')->constrained('challans')->cascadeOnDelete();

            $table->string('label');                     // "First Semester Installment Fee"
            $table->decimal('amount', 10, 2);            // negative allowed (discounts)
            $table->enum('type', ['fee', 'discount', 'late_fee', 'conditional'])
                  ->default('fee');

            // Traceability: which fee_structure row this line was copied from (if any).
            // Nullable + nullOnDelete so deleting a fee structure never breaks an
            // already-issued challan line (it just loses the back-link).
            $table->foreignId('fee_structure_id')
                  ->nullable()
                  ->constrained('fee_structures')
                  ->nullOnDelete();

            $table->unsignedSmallInteger('sort_order')->default(0); // display order
            $table->timestamps();

            $table->index('challan_id');
        });

        // 2) Extend challans with the fields the line-item model needs.
        Schema::table('challans', function (Blueprint $table) {
            // Human title shown on the challan heading, e.g. "First Semester
            // Installment Fee". Nullable so existing rows are untouched.
            $table->string('title')->nullable()->after('challan_type');

            // Installment number ("INSTALLMENT 1" on the printed challan). Nullable
            // because one-off challans (e.g. a conditional fee) may have none.
            $table->unsignedTinyInteger('installment_no')->nullable()->after('semester_no');

            // How this challan was generated / what it covers. 'custom' = admin
            // hand-built it from arbitrary items.
            $table->enum('scope', ['semester', 'year', 'program', 'custom'])
                  ->nullable()
                  ->after('installment_no');
        });

        // NOTE: the existing `fee_breakdown` JSON column is intentionally LEFT in
        // place for now (not dropped). New challans will populate challan_items;
        // fee_breakdown becomes redundant once the service is rewritten. We remove
        // it in a later, separate migration once nothing reads it — keeping this
        // migration purely additive and safe to run/rollback.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('challans', function (Blueprint $table) {
            $table->dropColumn(['title', 'installment_no', 'scope']);
        });

        Schema::dropIfExists('challan_items');
    }
};