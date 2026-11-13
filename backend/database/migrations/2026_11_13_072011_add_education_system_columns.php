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
        Schema::table('student_educations', function (Blueprint $table) {
            // Key from config admission.education_levels.*.systems (ssc, o_level, hssc, a_level). NULL = level has no systems.
            $table->string('system', 30)->nullable()->after('level');
            // O / A Level grades as written on the result, e.g. "3 A*, 4 A, 1 B".
            $table->string('grades_summary', 255)->nullable()->after('grade');
        });

        Schema::table('required_document_types', function (Blueprint $table) {
            // Only ask this document when the row uses this system (e.g. IBCC => o_level). NULL = every system.
            $table->string('education_system', 30)->nullable()->after('education_level');
        });
    }

    public function down(): void
    {
        Schema::table('student_educations', function (Blueprint $table) {
            $table->dropColumn(['system', 'grades_summary']);
        });
        Schema::table('required_document_types', function (Blueprint $table) {
            $table->dropColumn('education_system');
        });
    }
};
