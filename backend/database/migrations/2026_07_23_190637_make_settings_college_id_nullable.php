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
        Schema::table('settings', function (Blueprint $table) {
            $table->dropForeign(['college_id']);
        });
        Schema::table('settings', function (Blueprint $table) {
            $table->foreignId('college_id')->nullable()->change();
            $table->foreign('college_id')->references('id')->on('colleges')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropForeign(['college_id']);
            $table->foreignId('college_id')->nullable(false)->change();
            $table->foreign('college_id')->references('id')->on('colleges')->cascadeOnDelete();
        });
    }
};
