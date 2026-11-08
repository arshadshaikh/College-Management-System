<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // users.phone already holds the applicant's mobile number.
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn('mobile');
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('mobile', 20)->nullable();
        });
    }
};