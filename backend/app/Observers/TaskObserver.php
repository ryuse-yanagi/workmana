<?php

namespace App\Observers;

use App\Enums\TaskHistoryEventType;
use App\Models\Task;
use App\Models\TaskHistory;

class TaskObserver
{
    public function created(Task $task): void
    {
        TaskHistory::query()->create([
            'task_id' => $task->id,
            'organization_id' => $task->organization_id,
            'project_id' => $task->project_id,
            'actor_id' => auth()->id(),
            'event_type' => TaskHistoryEventType::TaskCreated->value,
            'field_name' => null,
            'before_value' => null,
            'after_value' => null,
            'created_at' => now(),
        ]);
    }

    public function updated(Task $task): void
    {
        $actorId = auth()->id();

        foreach (['status' => TaskHistoryEventType::StatusChanged, 'priority' => TaskHistoryEventType::PriorityChanged] as $field => $event) {
            if ($task->wasChanged($field)) {
                TaskHistory::query()->create([
                    'task_id' => $task->id,
                    'organization_id' => $task->organization_id,
                    'project_id' => $task->project_id,
                    'actor_id' => $actorId,
                    'event_type' => $event->value,
                    'field_name' => $field,
                    'before_value' => (string) $task->getOriginal($field),
                    'after_value' => (string) $task->getAttribute($field),
                    'created_at' => now(),
                ]);
            }
        }

        if ($task->wasChanged('assignee_id')) {
            TaskHistory::query()->create([
                'task_id' => $task->id,
                'organization_id' => $task->organization_id,
                'project_id' => $task->project_id,
                'actor_id' => $actorId,
                'event_type' => TaskHistoryEventType::AssigneeChanged->value,
                'field_name' => 'assignee_id',
                'before_value' => $task->getOriginal('assignee_id') !== null ? (string) $task->getOriginal('assignee_id') : null,
                'after_value' => $task->assignee_id !== null ? (string) $task->assignee_id : null,
                'created_at' => now(),
            ]);
        }

        if ($task->wasChanged('due_date')) {
            TaskHistory::query()->create([
                'task_id' => $task->id,
                'organization_id' => $task->organization_id,
                'project_id' => $task->project_id,
                'actor_id' => $actorId,
                'event_type' => TaskHistoryEventType::DueDateChanged->value,
                'field_name' => 'due_date',
                'before_value' => optional($task->getOriginal('due_date'))?->toIso8601String(),
                'after_value' => optional($task->due_date)?->toIso8601String(),
                'created_at' => now(),
            ]);
        }

        foreach (['title', 'description'] as $field) {
            if ($task->wasChanged($field)) {
                TaskHistory::query()->create([
                    'task_id' => $task->id,
                    'organization_id' => $task->organization_id,
                    'project_id' => $task->project_id,
                    'actor_id' => $actorId,
                    'event_type' => TaskHistoryEventType::TaskUpdated->value,
                    'field_name' => $field,
                    'before_value' => $task->getOriginal($field) !== null ? (string) $task->getOriginal($field) : null,
                    'after_value' => $task->getAttribute($field) !== null ? (string) $task->getAttribute($field) : null,
                    'created_at' => now(),
                ]);
            }
        }

        if ($task->wasChanged('deleted_at') && $task->deleted_at !== null) {
            TaskHistory::query()->create([
                'task_id' => $task->id,
                'organization_id' => $task->organization_id,
                'project_id' => $task->project_id,
                'actor_id' => $actorId,
                'event_type' => TaskHistoryEventType::TaskDeleted->value,
                'field_name' => null,
                'before_value' => null,
                'after_value' => null,
                'created_at' => now(),
            ]);
        }
    }
}
