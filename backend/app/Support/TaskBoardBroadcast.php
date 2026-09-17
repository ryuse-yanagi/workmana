<?php

namespace App\Support;

use App\Models\Task;

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
            'start_date' => $task->start_date,
            'due_date' => $task->due_date,
            'gantt_bar_color' => $task->gantt_bar_color,
            'effort_hours' => $task->effort_hours,
            'progress_rate' => $task->progress_rate,
            'labels' => $task->labels->map(fn ($l) => [
                'id' => $l->id,
                'name' => $l->name,
                'color_index' => $l->color_index,
            ])->all(),
            'assignees' => $task->assignees
                ->sortBy([
                    fn ($u) => mb_strtolower((string) ($u->name ?: $u->email ?: '')),
                    fn ($u) => $u->id,
                ])
                ->values()
                ->map(fn ($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'avatar_url' => MediaUrl::avatar($u->avatar_path),
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
