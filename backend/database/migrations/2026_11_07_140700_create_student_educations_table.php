<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_educations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();

            $table->string('level', 50);                       // slug: matric, intermediate, bachelors, masters, mphil...
            $table->string('degree_title')->nullable();        // "BS Computer Science", "Pre-Engineering"
            $table->string('board_university')->nullable();    // awarding body
            $table->string('institution')->nullable();         // school / college / campus attended
            $table->string('roll_no', 50)->nullable();
            $table->unsignedSmallInteger('passing_year')->nullable();

            $table->unsignedInteger('total_marks')->nullable();     // marks-based levels
            $table->unsignedInteger('obtained_marks')->nullable();
            $table->string('grade', 10)->nullable();
            $table->decimal('cgpa', 4, 2)->nullable();               // GPA-based levels
            $table->decimal('cgpa_scale', 4, 2)->nullable();         // 4.00 or 5.00

            // Certificate file; filled in once documents can belong to a profile (step 3).
            $table->foreignId('document_id')->nullable()->constrained('documents')->nullOnDelete();

            $table->timestamps();

            $table->unique(['student_id', 'level']);              // one row per level per student
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_educations');
    }
};