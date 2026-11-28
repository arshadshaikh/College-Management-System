<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Paid add-ons on top of a plan (platform level), the add-ons each college has,
 * and whether a college's current plan period is a free trial.
 *
 *  kind = feature  → unlocks one feature key from config/plans.php
 *  kind = students → each unit adds students_per_unit to the plan's student limit
 *  price is per month, per unit. college_addon.price keeps the price the college was
 *  given, so a later price change on the add-on does not change existing colleges.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addons', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->string('description', 500)->nullable();
            $table->enum('kind', ['feature', 'students']);
            $table->string('feature', 50)->nullable();
            $table->unsignedInteger('students_per_unit')->nullable();
            $table->decimal('price', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('college_addon', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained('colleges')->cascadeOnDelete();
            $table->foreignId('addon_id')->constrained('addons')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('price', 12, 2)->default(0);
            $table->timestamps();
            $table->unique(['college_id', 'addon_id']);
        });

        Schema::table('colleges', function (Blueprint $table) {
            $table->boolean('on_trial')->default(false)->after('plan_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('colleges', function (Blueprint $table) {
            $table->dropColumn('on_trial');
        });
        Schema::dropIfExists('college_addon');
        Schema::dropIfExists('addons');
    }
};
