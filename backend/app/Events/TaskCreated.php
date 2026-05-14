<?php

namespace App\Events;

use App\Models\Task;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TaskCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Task $task)
    {
        $this->task->loadMissing(['labels:id,name,color']);
    }

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("projects.{$this->task->project_id}")];
    }

    public function broadcastAs(): string
    {
        return 'TaskCreated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'task' => [
                'id' => $this->task->id,
                'list_id' => $this->task->list_id,
                'title' => $this->task->title,
                'status' => $this->task->status,
                'labels' => $this->task->labels->map(fn ($l) => [
                    'id' => $l->id,
                    'name' => $l->name,
                    'color' => $l->color,
                ])->all(),
            ],
        ];
    }
}
