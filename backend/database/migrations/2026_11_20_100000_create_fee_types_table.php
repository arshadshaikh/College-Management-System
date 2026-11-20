<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fee types become per-college DATA (Settings -> Fees & Challans) instead of a
 * fixed enum. fee_structures.fee_type now holds a fee_types.slug.
 * Every existing college gets the 8 old types, so existing fees keep working.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fee_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->string('slug', 50);                 // stored on fee_structures.fee_type
            $table->string('name', 100);                // shown in dropdowns and on challans
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['college_id', 'slug']);
        });

        $defaults = [
            'admission' => 'Admission', 'semester' => 'Semester', 'exam' => 'Exam',
            'library' => 'Library', 'sports' => 'Sports', 'security_deposit' => 'Security Deposit',
            'arrears' => 'Arrears', 'other' => 'Other',
        ];
        foreach (DB::table('colleges')->pluck('id') as $collegeId) {
            $i = 0;
            foreach ($defaults as $slug => $name) {
                DB::table('fee_types')->insert([
                    'college_id' => $collegeId, 'slug' => $slug, 'name' => $name,
                    'is_active' => true, 'sort_order' => ++$i,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }

        // Free text now; the controller checks it against this college's fee_types.
        DB::statement("ALTER TABLE fee_structures MODIFY fee_type VARCHAR(50) NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE fee_structures MODIFY fee_type ENUM('admission','semester','exam','library','sports','security_deposit','arrears','other') NOT NULL");
        Schema::dropIfExists('fee_types');
    }
};
