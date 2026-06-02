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
        Schema::table('roles', function (Blueprint $table) {
            // NULL = platform-level role (super admin)
            // Set  = college-specific role
            $table->foreignId('college_id')
                  ->nullable()
                  ->after('id')
                  ->constrained('colleges')
                  ->cascadeOnDelete();

            // 'platform' | 'college' | 'student'
            $table->enum('scope', ['platform', 'college', 'student'])
                  ->default('college')
                  ->after('college_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropForeign(['college_id']);
            $table->dropColumn(['college_id', 'scope']);
        });
    }
};
