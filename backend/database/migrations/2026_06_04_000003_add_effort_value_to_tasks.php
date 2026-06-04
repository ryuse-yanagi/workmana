<?php

use App\Enums\TaskEffortUnit;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->decimal('effort_value', 12, 4)->nullable()->after('effort_hours');
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('tasks', function (Blueprint $table) {
                $table->decimal('effort_hours', 12, 6)->nullable()->change();
            });
        }

        $tasks = DB::table('tasks')
            ->whereNotNull('effort_hours')
            ->get(['id', 'effort_hours', 'effort_unit']);

        foreach ($tasks as $task) {
            $hours = (float) $task->effort_hours;
            $unit = $task->effort_unit ?? TaskEffortUnit::Hour->value;
            $value = match ($unit) {
                TaskEffortUnit::Minute->value => $hours * 60,
                TaskEffortUnit::Day->value => $hours / 24,
                default => $hours,
            };

            DB::table('tasks')->where('id', $task->id)->update([
                'effort_value' => round($value, 4),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('effort_value');
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('tasks', function (Blueprint $table) {
                $table->decimal('effort_hours', 8, 2)->nullable()->change();
            });
        }
    }
};
