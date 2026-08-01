<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WbsTasksReordered implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<int, array{id: int, sort_order: int, parent_task_id: int|null}>  $tasks
     */
    public function __construct(
        public int $workspaceId,
        public array $tasks,
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("workspaces.{$this->workspaceId}")];
    }

    public function broadcastAs(): string
    {
        return 'WbsTasksReordered';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'tasks' => $this->tasks,
        ];
    }
}
