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
        Schema::create('required_document_types', function (Blueprint $table) {
            $table->id();
            // Which flow this document belongs to. 'college_registration' now;
            // 'student_application' later — same mechanism, different scope.
            $table->string('scope')->default('college_registration');
            $table->string('name');                    // "Registration Certificate"
            $table->string('slug');                    // "registration_certificate"
            $table->boolean('is_mandatory')->default(true);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['scope', 'slug']);         // no duplicate slugs within a scope
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('required_document_types');
    }
};
