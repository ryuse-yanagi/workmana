<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('task_checklists', function (Blueprint $table) {
            $table->dropUnique(['task_id']);
            $table->unsignedInteger('sort_order')->default(0)->after('title');
            $table->index(['task_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::table('task_checklists', function (Blueprint $table) {
            $table->dropIndex(['task_id', 'sort_order']);
            $table->dropColumn('sort_order');
            $table->unique('task_id');
        });
    }
};
