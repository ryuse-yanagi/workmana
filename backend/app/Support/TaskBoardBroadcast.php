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
            'labels:id,name,color',
            'assignees:id,name,email,avatar_path',
            'heading:id,name',
        ]);

        return [
            'id' => $task->id,
            'list_id' => $task->list_id,
            'task_heading_id' => $task->task_heading_id,
            'heading' => $task->heading
                ? ['id' => $task->heading->id, 'name' => $task->heading->name]
                : null,
            'sort_order' => $task->sort_order,
            'title' => $task->title,
            'status' => $task->status,
            'labels' => $task->labels->map(fn ($l) => [
                'id' => $l->id,
                'name' => $l->name,
                'color' => $l->color,
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
            'start_date' => $task->start_date,
            'due_date' => $task->due_date,
            'effort_hours' => $task->effort_hours,
            'effort_value' => $task->effort_value,
            'effort_unit' => $task->effort_unit,
        ]);
    }
}
