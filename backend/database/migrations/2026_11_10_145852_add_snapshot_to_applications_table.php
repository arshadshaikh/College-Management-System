<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // New status 'returned' = sent back to the student for correction (unlocks the profile).
        DB::statement("ALTER TABLE applications MODIFY status ENUM('draft','submitted','under_review','returned','shortlisted','approved','rejected','withdrawn') NOT NULL DEFAULT 'draft'");
        Schema::table('applications', function (Blueprint $table) {
            $table->text('correction_note')->nullable()->after('rejection_reason');   // admin's reason for returning
            $table->json('profile_snapshot')->nullable()->after('admission_year');     // what was submitted
            $table->timestamp('submitted_at')->nullable()->after('profile_snapshot');
        });
    }
    
    public function down(): void
    {
        DB::table('applications')->where('status', 'returned')->update(['status' => 'submitted']);
        DB::statement("ALTER TABLE applications MODIFY status ENUM('draft','submitted','under_review','shortlisted','approved','rejected','withdrawn') NOT NULL DEFAULT 'draft'");
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['correction_note', 'profile_snapshot', 'submitted_at']);
        });
    }
};
