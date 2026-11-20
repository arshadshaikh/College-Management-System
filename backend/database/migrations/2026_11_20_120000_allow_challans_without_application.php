<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A challan no longer needs an admission application: hostel, transcript, exam,
 * fines ... can be billed to any student. program_id says which program the
 * challan is for (copied from the application for existing rows).
 * challan_type becomes free text (a fee type slug, or the old values).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('challans', function (Blueprint $table) {
            $table->foreignId('program_id')->nullable()->after('application_id')
                ->constrained('programs')->nullOnDelete();
        });

        DB::statement('ALTER TABLE challans MODIFY application_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE challans MODIFY challan_type VARCHAR(50) NOT NULL');

        DB::statement('UPDATE challans c JOIN applications a ON a.id = c.application_id SET c.program_id = a.program_id');
    }

    public function down(): void
    {
        DB::statement("UPDATE challans SET challan_type = 'other' WHERE challan_type NOT IN ('admission','semester','exam','arrears','other')");
        DB::statement("ALTER TABLE challans MODIFY challan_type ENUM('admission','semester','exam','arrears','other') NOT NULL");
        // Rows without an application cannot go back; remove them first if you roll back.
        DB::statement('ALTER TABLE challans MODIFY application_id BIGINT UNSIGNED NOT NULL');

        Schema::table('challans', function (Blueprint $table) {
            $table->dropConstrainedForeignId('program_id');
        });
    }
};
