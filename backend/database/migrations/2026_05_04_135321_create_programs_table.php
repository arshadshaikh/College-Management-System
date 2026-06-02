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
        Schema::create('programs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained('colleges')->cascadeOnDelete();
            $table->string('name');                         // e.g. "BS Computer Science"
            $table->string('code')->nullable();             // e.g. "BSCS"
            $table->enum('degree_level', ['certificate', 'diploma', 'associate',
                                           'bachelor', 'master', 'phd']);
            $table->unsignedTinyInteger('duration_years');  // 2, 4, etc.
            $table->unsignedSmallInteger('total_semesters');
            $table->unsignedSmallInteger('total_seats')->default(60);
            $table->text('eligibility_criteria')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            // A college can't have two programs with the same code
            $table->unique(['college_id', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('programs');
    }
};
