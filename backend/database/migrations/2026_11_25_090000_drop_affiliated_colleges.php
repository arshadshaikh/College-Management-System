<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Each tenant is one college, with no affiliated colleges, so the Affiliated Colleges
 * list (added 2026_11_22) is removed: its table, its 4 privileges, its sidebar item
 * and their role grants. Safe to run on a database that never had them.
 */
return new class extends Migration
{
    private array $slugs = [
        'affiliated-colleges.index', 'affiliated-colleges.store',
        'affiliated-colleges.update', 'affiliated-colleges.destroy',
        'menu.affiliated-colleges',
    ];

    public function up(): void
    {
        $ids = DB::table('privileges')->whereIn('slug', $this->slugs)->pluck('id');
        if ($ids->isNotEmpty()) {
            DB::table('privilege_role')->whereIn('privilege_id', $ids)->delete();
            DB::table('privileges')->whereIn('id', $ids)->delete();
        }
        DB::table('privilege_groups')->where('slug', 'affiliated-college-management')
            ->whereNotExists(fn ($q) => $q->from('privileges')->whereColumn('privileges.privilege_group_id', 'privilege_groups.id'))
            ->delete();

        Schema::dropIfExists('affiliated_colleges');
    }

    // Brings back the empty table only; privileges would come from the old seeder.
    public function down(): void
    {
        if (Schema::hasTable('affiliated_colleges')) {
            return;
        }
        Schema::create('affiliated_colleges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->string('name', 191);
            $table->string('city', 100)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['college_id', 'code']);
            $table->index(['college_id', 'name']);
        });
    }
};
