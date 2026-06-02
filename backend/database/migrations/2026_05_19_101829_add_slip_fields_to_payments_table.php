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
        Schema::table('payments', function (Blueprint $table) {
            $table->string('slip_path')->nullable()->after('notes');
            $table->boolean('slip_verified')->default(false)->after('slip_path');
            $table->foreignId('slip_verified_by')->nullable()
                  ->after('slip_verified')
                  ->constrained('users')->nullOnDelete();
            $table->timestamp('slip_verified_at')->nullable()->after('slip_verified_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['slip_verified_by']);
            $table->dropColumn(['slip_path', 'slip_verified', 'slip_verified_by', 'slip_verified_at']);
        });
    }
};
