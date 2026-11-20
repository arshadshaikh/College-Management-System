<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Exam scheme of a program: 'semester' (default, all existing programs) or
 * 'annual' (University "Part 1, Part 2 ..." system). For annual programs
 * total_semesters means total parts, and fee_structures/challans use
 * semester_no as the part number.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            $table->enum('scheme', ['semester', 'annual'])->default('semester')->after('degree_level');
        });
    }

    public function down(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            $table->dropColumn('scheme');
        });
    }
};
