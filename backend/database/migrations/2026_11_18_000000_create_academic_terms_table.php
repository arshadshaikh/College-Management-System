<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Academic terms (e.g. "Fall 2026", "2026–27"). Every timetable belongs to a term:
 * term + program + semester + shift. One term per college is marked current.
 * Existing timetable rows are moved into a starter term named after this year.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_terms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_current')->default(false);
            $table->timestamps();

            $table->unique(['college_id', 'name']);
        });

        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->foreignId('academic_term_id')->nullable()->after('college_id')
                ->constrained('academic_terms')->cascadeOnDelete();
        });

        // Starter term for colleges that already have timetable rows.
        $year = (int) date('Y');
        foreach (DB::table('timetable_entries')->distinct()->pluck('college_id') as $collegeId) {
            $termId = DB::table('academic_terms')->insertGetId([
                'college_id' => $collegeId,
                'name'       => (string) $year,
                'start_date' => "{$year}-01-01",
                'end_date'   => "{$year}-12-31",
                'is_current' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('timetable_entries')->where('college_id', $collegeId)->update(['academic_term_id' => $termId]);
        }

        // One class per cell of a TERM's program-semester-shift grid.
        // program_id gets its own index first: the old unique key also served its foreign key.
        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->index('program_id', 'timetable_program_index');
            $table->unique(
                ['academic_term_id', 'program_id', 'semester_no', 'shift', 'day', 'timetable_period_id'],
                'timetable_cell_term_unique'
            );
        });
        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->dropUnique('timetable_cell_shift_unique');
        });
    }

    public function down(): void
    {
        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->unique(['program_id', 'semester_no', 'shift', 'day', 'timetable_period_id'], 'timetable_cell_shift_unique');
        });
        Schema::table('timetable_entries', function (Blueprint $table) {
            $table->dropUnique('timetable_cell_term_unique');
            $table->dropIndex('timetable_program_index');
            $table->dropConstrainedForeignId('academic_term_id');
        });
        Schema::dropIfExists('academic_terms');
    }
};
