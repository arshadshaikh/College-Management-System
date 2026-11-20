<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Exam-style fees differ by candidate (Regular / Private) and exam (Regular / Failure).
 * A fee line set to 'any' applies to everyone, so every existing fee keeps working.
 * A challan remembers which candidate/exam it was billed for (printed on the PDF).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fee_structures', function (Blueprint $table) {
            $table->enum('candidate_type', ['any', 'regular', 'private'])->default('any')->after('semester_no');
            $table->enum('exam_type', ['any', 'regular', 'failure'])->default('any')->after('candidate_type');
        });

        Schema::table('challans', function (Blueprint $table) {
            $table->enum('candidate_type', ['regular', 'private'])->nullable()->after('semester_no');
            $table->enum('exam_type', ['regular', 'failure'])->nullable()->after('candidate_type');
        });
    }

    public function down(): void
    {
        Schema::table('challans', function (Blueprint $table) {
            $table->dropColumn(['candidate_type', 'exam_type']);
        });
        Schema::table('fee_structures', function (Blueprint $table) {
            $table->dropColumn(['candidate_type', 'exam_type']);
        });
    }
};
