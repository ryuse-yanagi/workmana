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
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('list_id')->constrained('lists')->restrictOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_parent_task')->default(false);
            $table->foreignId('parent_task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->string('title', 500);
            $table->text('description')->nullable();
            $table->string('status', 32)->default('todo');
            $table->string('priority', 32)->default('medium');
            $table->timestamp('start_date')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->string('gantt_bar_color', 7)->nullable();
            $table->decimal('effort_hours', 12, 6)->nullable();
            $table->decimal('effort_value', 12, 4)->nullable();
            $table->string('effort_unit', 16)->nullable();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reporter_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('archived_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
            $table->index(['workspace_id', 'deleted_at', 'created_at']);
            $table->index(['organization_id', 'deleted_at']);
            $table->index(['assignee_id', 'deleted_at']);
            $table->index(['workspace_id', 'status', 'deleted_at']);
            $table->index(['workspace_id', 'due_date', 'deleted_at']);
            $table->index(['workspace_id', 'start_date', 'deleted_at']);
            $table->index(['workspace_id', 'archived_at']);
            $table->index(['list_id', 'sort_order']);
            $table->index(['workspace_id', 'is_parent_task']);
            $table->index(['parent_task_id']);
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo','in_progress','done'))");
            DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('low','medium','high'))");
        }

        Schema::create('task_assignees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['task_id', 'user_id']);
            $table->index(['user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_assignees');
        Schema::dropIfExists('tasks');
    }
};
