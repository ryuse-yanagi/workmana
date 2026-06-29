<?php

namespace App\Support;

use App\Models\Task;
use Illuminate\Support\Facades\Storage;

final class TaskBoardBroadcast
{
    /**
     * @return array<string, mixed>
     */
    public static function taskPayload(Task $task): array
    {
        $task->loadMissing([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
        ]);

        return [
            'id' => $task->id,
            'list_id' => $task->list_id,
            'sort_order' => $task->sort_order,
            'is_parent_task' => (bool) $task->is_parent_task,
            'parent_task_id' => $task->parent_task_id,
            'title' => $task->title,
            'status' => $task->status,
            'start_date' => $task->start_date,
            'due_date' => $task->due_date,
            'gantt_bar_color' => $task->gantt_bar_color,
            'effort_hours' => $task->effort_hours,
            'effort_value' => $task->effort_value,
            'effort_unit' => $task->effort_unit,
            'labels' => $task->labels->map(fn ($l) => [
                'id' => $l->id,
                'name' => $l->name,
                'color_index' => $l->color_index,
            ])->all(),
            'assignees' => $task->assignees->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'avatar_url' => $u->avatar_path
                    ? Storage::disk('public')->url($u->avatar_path)
                    : null,
            ])->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function taskDetailPayload(Task $task): array
    {
        return array_merge(self::taskPayload($task), [
            'description' => $task->description,
        ]);
    }
}
