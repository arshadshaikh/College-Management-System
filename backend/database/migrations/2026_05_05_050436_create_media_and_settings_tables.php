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
        // ─── Media Library ───────────────────────────────────────
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained('colleges')->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('media_type', ['image', 'document', 'video', 'other']);
            $table->string('original_name');
            $table->string('stored_path');
            $table->string('public_url')->nullable();
            $table->string('mime_type');
            $table->unsignedInteger('file_size');
            $table->unsignedSmallInteger('width')->nullable();  // images
            $table->unsignedSmallInteger('height')->nullable();
            $table->text('alt_text')->nullable();
            $table->timestamps();
        });

        // ─── Per-college key-value settings ──────────────────────
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            // NULL college_id = platform-level settings
            $table->foreignId('college_id')->nullable()
                  ->constrained('colleges')->cascadeOnDelete();
            $table->string('key');
            $table->text('value')->nullable();
            $table->string('group')->default('general'); // "branding","contact","admission"
            $table->timestamps();
            $table->unique(['college_id', 'key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('media');
        Schema::dropIfExists('settings');
    }
};
