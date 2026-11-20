<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Colleges affiliated with this university (or campuses of this college).
 * Exam enrolments (next step) record which affiliated college a student
 * belongs to, and the challan prints its name.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('affiliated_colleges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete(); // tenant (the university)
            $table->string('code', 20);                 // college code used by the university
            $table->string('name', 191);
            $table->string('city', 100)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['college_id', 'code']);
            $table->index(['college_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('affiliated_colleges');
    }
};
