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
            $table->unsignedInteger('sort_order')->default(0)->after('list_id');
            $table->index(['list_id', 'sort_order']);
        });

        $rows = DB::table('tasks')
            ->whereNotNull('list_id')
            ->whereNull('deleted_at')
            ->orderBy('list_id')
            ->orderByDesc('created_at')
            ->orderBy('id')
            ->get(['id', 'list_id']);

        $currentListId = null;
        $order = 0;
        foreach ($rows as $row) {
            if ($row->list_id !== $currentListId) {
                $currentListId = $row->list_id;
                $order = 0;
            }
            DB::table('tasks')->where('id', $row->id)->update(['sort_order' => $order]);
            $order++;
        }
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex(['list_id', 'sort_order']);
            $table->dropColumn('sort_order');
        });
    }
};
