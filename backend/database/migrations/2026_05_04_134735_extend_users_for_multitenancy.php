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
        Schema::table('users', function (Blueprint $table) {
            // NULL = super admin (platform level), set = tenant user
            $table->foreignId('college_id')
                  ->nullable()
                  ->after('id')
                  ->constrained('colleges')
                  ->nullOnDelete();

            // Quick scope check without joining roles
            $table->enum('user_type', ['super_admin', 'college_admin', 'student'])
                  ->default('student')
                  ->after('college_id');

            // $table->boolean('is_active')->default(true)->after('user_type');
        });

        
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['college_id']);
            $table->dropColumn(['college_id', 'user_type']);
        });
    }
};
