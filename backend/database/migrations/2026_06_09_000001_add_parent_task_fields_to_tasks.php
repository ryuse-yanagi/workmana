<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->boolean('is_parent_task')->default(false)->after('sort_order');
            $table->foreignId('parent_task_id')
                ->nullable()
                ->after('is_parent_task')
                ->constrained('tasks')
                ->nullOnDelete();
            $table->index(['project_id', 'is_parent_task']);
            $table->index(['parent_task_id']);
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_task_id');
            $table->dropColumn('is_parent_task');
        });
    }
};
