<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Subscription plans (platform level, not per college) and the plan each college is on.
 * features = JSON list of keys from config/plans.php. max_students NULL = unlimited.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->string('description', 500)->nullable();
            $table->decimal('price', 12, 2)->default(0);
            $table->enum('billing_period', ['monthly', 'yearly'])->default('yearly');
            $table->unsignedInteger('max_students')->nullable();
            $table->json('features')->nullable();
            $table->boolean('is_default')->default(false);   // given to a college when it is approved
            $table->boolean('is_active')->default(true);     // inactive plans can't be newly assigned
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('colleges', function (Blueprint $table) {
            $table->foreignId('plan_id')->nullable()->after('status')->constrained('plans')->nullOnDelete();
            $table->date('plan_expires_at')->nullable()->after('plan_id');
        });
    }

    public function down(): void
    {
        Schema::table('colleges', function (Blueprint $table) {
            $table->dropConstrainedForeignId('plan_id');
            $table->dropColumn('plan_expires_at');
        });
        Schema::dropIfExists('plans');
    }
};
