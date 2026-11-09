<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('college_document_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->foreignId('required_document_type_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_active')->default(true);     // does this college ask for it?
            $table->boolean('is_required')->default(false);  // required or optional here
            $table->timestamps();

            $table->unique(['college_id', 'required_document_type_id'], 'college_doc_type_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('college_document_types');
    }

};
