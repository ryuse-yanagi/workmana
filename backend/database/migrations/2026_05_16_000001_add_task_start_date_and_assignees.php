<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->timestamp('start_date')->nullable()->after('priority');
            $table->index(['project_id', 'start_date', 'deleted_at']);
        });

        Schema::create('task_assignees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['task_id', 'user_id']);
            $table->index(['user_id']);
        });

        $rows = DB::table('tasks')
            ->whereNotNull('assignee_id')
            ->get(['id', 'assignee_id']);
        foreach ($rows as $row) {
            DB::table('task_assignees')->insert([
                'task_id' => $row->id,
                'user_id' => $row->assignee_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('task_assignees');

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex(['project_id', 'start_date', 'deleted_at']);
            $table->dropColumn('start_date');
        });
    }
};
