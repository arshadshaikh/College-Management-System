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
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained('colleges')->cascadeOnDelete();
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->enum('document_type', [
                'cnic', 'matric_certificate', 'inter_certificate',
                'domicile', 'photo', 'character_certificate', 'other'
            ]);
            $table->string('original_name');
            $table->string('stored_path');      // storage/app/private/colleges/{id}/docs/
            $table->string('mime_type');
            $table->unsignedInteger('file_size'); // bytes
            $table->enum('verification_status', ['pending', 'verified', 'rejected'])
                  ->default('pending');
            $table->text('verification_notes')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
