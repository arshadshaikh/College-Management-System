<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Shifts (morning / noon / evening, see config/timetable.php).
 *  - each period belongs to one shift (a shift has its own day plan)
 *  - each timetable is per program + semester + shift
 *  - each application records the shift the student studies in
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('timetable_periods', function (Blueprint $table) {
            $table->string('shift', 20)->default('morning')->after('college_id');
        });

        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->string('shift', 20)->default('morning')->after('semester_no');
        });
        // Add the new unique key first: the old one also serves the program_id foreign key.
        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->unique(['program_id', 'semester_no', 'shift', 'day', 'timetable_period_id'], 'timetable_cell_shift_unique');
        });
        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->dropUnique('timetable_cell_unique');
        });

        Schema::table('applications', function (Blueprint $table) {
            $table->string('shift', 20)->default('morning')->after('semester_no');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('shift');
        });
        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->unique(['program_id', 'semester_no', 'day', 'timetable_period_id'], 'timetable_cell_unique');
        });
        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->dropUnique('timetable_cell_shift_unique');
            $table->dropColumn('shift');
        });
        Schema::table('timetable_periods', function (Blueprint $table) {
            $table->dropColumn('shift');
        });
    }
};
