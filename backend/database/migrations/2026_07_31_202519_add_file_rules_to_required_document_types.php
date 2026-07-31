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
        Schema::table('required_document_types', function (Blueprint $table) {
            $table->string('allowed_mime_types')->default('image/jpeg,image/png,application/pdf')->after('is_mandatory');
            $table->unsignedInteger('max_size_kb')->default(4096)->after('allowed_mime_types');
            $table->unsignedSmallInteger('max_dimension')->nullable()->after('max_size_kb');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('required_document_types', function (Blueprint $table) {
            $table->dropColumn(['allowed_mime_types', 'max_size_kb', 'max_dimension']);
        });
    }
};
