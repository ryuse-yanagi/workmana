<?php

use App\Support\LabelColorPresets;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name', 40);
            $table->unsignedTinyInteger('color_index')->default(LabelColorPresets::DEFAULT_INDEX);
            $table->timestamps();
            $table->unique(['organization_id', 'name']);
            $table->index(['organization_id', 'created_at']);
        });

        Schema::create('workspace_workspace_label', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_label_id')->constrained('workspace_labels')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['workspace_id', 'workspace_label_id']);
        });

        Schema::create('task_labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name', 40);
            $table->unsignedTinyInteger('color_index')->default(LabelColorPresets::DEFAULT_INDEX);
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
        Schema::dropIfExists('workspace_workspace_label');
        Schema::dropIfExists('workspace_labels');
    }
};
