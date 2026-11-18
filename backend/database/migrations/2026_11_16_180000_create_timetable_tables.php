<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Class timetable.
 *  - timetable_periods : the college's daily time slots (Period 1 08:30-09:30, Break, ...)
 *  - courses           : subjects taught in a program's semester
 *  - timetable_entries : one cell of the weekly grid (program + semester + day + period)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timetable_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);                  // "Period 1", "Break"
            $table->time('start_time');
            $table->time('end_time');
            $table->boolean('is_break')->default(false); // breaks show in the grid but take no class
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('semester_no');
            $table->string('code', 30);                  // "CS-101"
            $table->string('title');                     // "Programming Fundamentals"
            $table->decimal('credit_hours', 3, 1)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['program_id', 'code']);
        });

        Schema::create('timetable_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('semester_no');
            $table->unsignedTinyInteger('day');          // 1 = Monday ... 7 = Sunday
            $table->foreignId('timetable_period_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('teacher_name', 100)->nullable();
            $table->string('room', 50)->nullable();
            $table->timestamps();

            // One class per cell of a program-semester grid
            $table->unique(['program_id', 'semester_no', 'day', 'timetable_period_id'], 'timetable_cell_unique');
            // Used by the room / teacher clash checks
            $table->index(['college_id', 'day', 'timetable_period_id'], 'timetable_slot_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timetable_entries');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('timetable_periods');
    }
};
