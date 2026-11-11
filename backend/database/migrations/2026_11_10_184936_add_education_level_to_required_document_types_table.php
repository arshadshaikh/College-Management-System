<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('required_document_types', function (Blueprint $table) {
            // Key from config/admission.php education_levels (matric, intermediate, ...).
            // NULL = a general document (CNIC, photo, domicile ...).
            $table->string('education_level', 30)->nullable()->after('scope')->index();
        });
    }

    public function down(): void
    {
        Schema::table('required_document_types', function (Blueprint $table) {
            $table->dropIndex(['education_level']);
            $table->dropColumn('education_level');
        });
    }
};
