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
        // Schema::table('include_college_id', function (Blueprint $table) {
        //     //
        // });

        Schema::table('roles', function (Blueprint $table) {
            // Drop the old single-column unique index
            $table->dropUnique(['slug']);

            // Add composite unique: same slug can exist per college
            $table->unique(['slug', 'college_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            // Drop the composite unique index
            $table->dropUnique(['slug', 'college_id']);

            // Add back the single-column unique index
            $table->unique(['slug']);
        });
    }
};
