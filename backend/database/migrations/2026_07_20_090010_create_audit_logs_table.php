<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();

            // Tenant scope. Nullable because super-admin actions on the
            // main domain (e.g. approving a college) have no tenant.
            $table->foreignId('college_id')->nullable()
                  ->constrained('colleges')->nullOnDelete();

            // Who did it. Nullable so the record survives user deletion.
            $table->foreignId('user_id')->nullable()
                  ->constrained('users')->nullOnDelete();

            // What they did, e.g. "application.approved", "challan.marked_paid"
            $table->string('action');

            // What it was done to (polymorphic: Application, Challan, College...)
            $table->string('auditable_type')->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();

            // Optional before/after snapshot and free-form context
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();

            // Request context
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();

            $table->timestamps();

            // Indexes for the queries you'll actually run
            $table->index(['college_id', 'created_at']);
            $table->index(['auditable_type', 'auditable_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};