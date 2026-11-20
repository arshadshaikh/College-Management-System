<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A fee type with a service_amount is a service students can request
 * themselves from the portal (Transcript, Degree, Duplicate ID Card ...).
 * NULL = not requestable (it is billed through program fees or by the office).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fee_types', function (Blueprint $table) {
            $table->decimal('service_amount', 10, 2)->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('fee_types', function (Blueprint $table) {
            $table->dropColumn('service_amount');
        });
    }
};
