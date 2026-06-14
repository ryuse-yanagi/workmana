<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('task_heading_id');
        });

        Schema::dropIfExists('task_headings');
    }

    public function down(): void
    {
        Schema::create('task_headings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name', 80);
            $table->timestamps();
            $table->unique(['project_id', 'name']);
            $table->index(['project_id', 'created_at']);
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('task_heading_id')
                ->nullable()
                ->after('list_id')
                ->constrained('task_headings')
                ->nullOnDelete();
        });
    }
};
