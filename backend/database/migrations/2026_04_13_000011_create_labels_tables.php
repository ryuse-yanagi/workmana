<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name', 40);
            $table->string('color', 20)->default('#64748b');
            $table->timestamps();
            $table->unique(['organization_id', 'name']);
            $table->index(['organization_id', 'created_at']);
        });

        Schema::create('project_project_label', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_label_id')->constrained('project_labels')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['project_id', 'project_label_id']);
        });

        Schema::create('task_labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name', 40);
            $table->string('color', 20)->default('#64748b');
            $table->timestamps();
            $table->unique(['organization_id', 'name']);
            $table->index(['organization_id', 'created_at']);
        });

        Schema::create('task_task_label', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('task_label_id')->constrained('task_labels')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['task_id', 'task_label_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_task_label');
        Schema::dropIfExists('task_labels');
        Schema::dropIfExists('project_project_label');
        Schema::dropIfExists('project_labels');
    }
};
