<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            // NULL application_id = profile document owned by the student.
            $table->unsignedBigInteger('application_id')->nullable()->change();
            // Holds a required_document_types slug instead of a fixed enum.
            $table->string('document_type', 100)->change();
            $table->index(['student_id', 'document_type']);
        });
    }

    public function down(): void
    {
        // Only safe while no profile documents (NULL application_id) or new slugs exist.
        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['student_id', 'document_type']);
            $table->enum('document_type', [
                'cnic', 'matric_certificate', 'inter_certificate', 'domicile',
                'photo', 'character_certificate', 'other',
            ])->change();
            $table->unsignedBigInteger('application_id')->nullable(false)->change();
        });
    }
};