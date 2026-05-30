<?php

namespace App\Events;

use App\Models\Task;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TaskArchived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, mixed>  $task
     */
    public function __construct(
        public int $projectId,
        public int $taskId,
        public array $task,
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("projects.{$this->projectId}")];
    }

    public function broadcastAs(): string
    {
        return 'TaskArchived';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->taskId,
            'task' => $this->task,
        ];
    }

    public static function fromTask(Task $task): self
    {
        $task->loadMissing(['labels:id,name,color']);

        return new self(
            (int) $task->project_id,
            (int) $task->id,
            [
                'id' => $task->id,
                'list_id' => $task->list_id,
                'title' => $task->title,
                'status' => $task->status,
                'archived_at' => $task->archived_at?->toIso8601String(),
            ],
        );
    }
}
