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
        Schema::create('student_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignId('college_id')->constrained('colleges')->cascadeOnDelete();
            $table->string('registration_no')->nullable()->unique();
            $table->string('father_name');
            $table->string('cnic', 15)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->string('nationality')->default('Pakistani');
            $table->string('religion')->nullable();
            $table->text('permanent_address')->nullable();
            $table->string('emergency_contact')->nullable();
            $table->string('matric_marks')->nullable();
            $table->string('matric_board')->nullable();
            $table->string('matric_year')->nullable();
            $table->string('inter_marks')->nullable();
            $table->string('inter_board')->nullable();
            $table->string('inter_year')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_profiles');
    }
};
