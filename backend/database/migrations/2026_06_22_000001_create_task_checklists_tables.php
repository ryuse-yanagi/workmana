<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->foreignId('workspace_id')->constrained()->restrictOnDelete();
            $table->string('title', 255);
            $table->timestamps();
            $table->index(['workspace_id']);
        });

        Schema::create('task_checklist_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('task_checklist_id')->constrained()->cascadeOnDelete();
            $table->text('text');
            $table->boolean('checked')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['task_checklist_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_checklist_items');
        Schema::dropIfExists('task_checklists');
    }
};
