<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('mobile', 20)->nullable();
            $table->string('domicile_province', 100)->nullable();
            $table->string('domicile_district', 100)->nullable();
            $table->string('prc_no', 50)->nullable();          // Permanent Residence Certificate
            $table->string('marital_status', 20)->nullable();  // allowed values are checked in validation, not here
            $table->text('present_address')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'mobile', 'domicile_province', 'domicile_district',
                'prc_no', 'marital_status', 'present_address',
            ]);
        });
    }
};