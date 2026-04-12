<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('section_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 500);
            $table->text('description')->nullable();
            $table->string('status', 32)->default('todo');
            $table->string('priority', 32)->default('medium');
            $table->timestamp('due_date')->nullable();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reporter_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'deleted_at', 'created_at']);
            $table->index(['organization_id', 'deleted_at']);
            $table->index(['assignee_id', 'deleted_at']);
            $table->index(['project_id', 'status', 'deleted_at']);
            $table->index(['project_id', 'due_date', 'deleted_at']);
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo','in_progress','done'))");
            DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('low','medium','high'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
