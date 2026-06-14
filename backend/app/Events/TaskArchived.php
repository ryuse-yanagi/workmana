<?php

namespace App\Events;

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

    /**
     * @param  array<string, mixed>  $taskSnapshot
     */
    public static function fromSnapshot(int $projectId, int $taskId, array $taskSnapshot): self
    {
        return new self($projectId, $taskId, $taskSnapshot);
    }
}
