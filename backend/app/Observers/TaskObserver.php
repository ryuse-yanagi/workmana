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
            'workspace_id' => $task->workspace_id,
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

        if ($task->wasChanged('priority')) {
            TaskHistory::query()->create([
                'task_id' => $task->id,
                'organization_id' => $task->organization_id,
                'workspace_id' => $task->workspace_id,
                'actor_id' => $actorId,
                'event_type' => TaskHistoryEventType::PriorityChanged->value,
                'field_name' => 'priority',
                'before_value' => (string) $task->getOriginal('priority'),
                'after_value' => (string) $task->getAttribute('priority'),
                'created_at' => now(),
            ]);
        }

        if ($task->wasChanged('list_id')) {
            TaskHistory::query()->create([
                'task_id' => $task->id,
                'organization_id' => $task->organization_id,
                'workspace_id' => $task->workspace_id,
                'actor_id' => $actorId,
                'event_type' => TaskHistoryEventType::ListChanged->value,
                'field_name' => 'list_id',
                'before_value' => $task->getOriginal('list_id') !== null ? (string) $task->getOriginal('list_id') : null,
                'after_value' => $task->list_id !== null ? (string) $task->list_id : null,
                'created_at' => now(),
            ]);
        }

        if ($task->wasChanged('start_date')) {
            TaskHistory::query()->create([
                'task_id' => $task->id,
                'organization_id' => $task->organization_id,
                'workspace_id' => $task->workspace_id,
                'actor_id' => $actorId,
                'event_type' => TaskHistoryEventType::StartDateChanged->value,
                'field_name' => 'start_date',
                'before_value' => optional($task->getOriginal('start_date'))?->toIso8601String(),
                'after_value' => optional($task->start_date)?->toIso8601String(),
                'created_at' => now(),
            ]);
        }

        if ($task->wasChanged('due_date')) {
            TaskHistory::query()->create([
                'task_id' => $task->id,
                'organization_id' => $task->organization_id,
                'workspace_id' => $task->workspace_id,
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
                    'workspace_id' => $task->workspace_id,
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
                'workspace_id' => $task->workspace_id,
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
