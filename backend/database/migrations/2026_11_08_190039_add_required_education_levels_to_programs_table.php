<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            // Extra levels this program requires ON TOP of the college baseline
            // (setting required_education_levels). Comma list of config/admission.php keys.
            $table->string('required_education_levels')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            $table->dropColumn('required_education_levels');
        });
    }
};