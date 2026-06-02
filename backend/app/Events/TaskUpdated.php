<?php

namespace App\Events;

use App\Models\Task;
use Illuminate\Support\Facades\Storage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TaskUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Task $task)
    {
        $this->task->loadMissing([
            'labels:id,name,color',
            'assignees:id,name,email,avatar_path',
            'heading:id,name',
        ]);
    }

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("projects.{$this->task->project_id}")];
    }

    public function broadcastAs(): string
    {
        return 'TaskUpdated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'task' => [
                'id' => $this->task->id,
                'list_id' => $this->task->list_id,
                'title' => $this->task->title,
                'description' => $this->task->description,
                'status' => $this->task->status,
                'start_date' => $this->task->start_date,
                'due_date' => $this->task->due_date,
                'task_heading_id' => $this->task->task_heading_id,
                'heading' => $this->task->heading
                    ? ['id' => $this->task->heading->id, 'name' => $this->task->heading->name]
                    : null,
                'labels' => $this->task->labels->map(fn ($l) => [
                    'id' => $l->id,
                    'name' => $l->name,
                    'color' => $l->color,
                ])->all(),
                'assignees' => $this->task->assignees->map(fn ($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'avatar_url' => $u->avatar_path
                        ? Storage::disk('public')->url($u->avatar_path)
                        : null,
                ])->all(),
            ],
        ];
    }
}
