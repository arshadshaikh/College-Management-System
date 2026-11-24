<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The group a student studied at Intermediate (Pre-Medical, Pre-Engineering ...).
 * Holds a key from config/admission.php education_levels.intermediate.groups.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_educations', function (Blueprint $table) {
            $table->string('study_group', 30)->nullable()->after('system');
        });
    }

    public function down(): void
    {
        Schema::table('student_educations', function (Blueprint $table) {
            $table->dropColumn('study_group');
        });
    }
};
