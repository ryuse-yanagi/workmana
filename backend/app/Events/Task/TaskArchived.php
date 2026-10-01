<?php

namespace App\Events\Task;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** タスクのアーカイブと同時にアーカイブした子を、そのスペースのプライベートチャンネルへ即時配信する。 */
class TaskArchived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, mixed>  $task
     */
    public function __construct(
        public int $workspaceId,
        public int $taskId,
        public array $task,
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("workspaces.{$this->workspaceId}")];
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
            'cascaded_task_ids' => $this->task['cascaded_task_ids'] ?? [],
        ];
    }

    /**
     * @param  array<string, mixed>  $taskSnapshot
     */
    public static function fromSnapshot(int $workspaceId, int $taskId, array $taskSnapshot): self
    {
        return new self($workspaceId, $taskId, $taskSnapshot);
    }
}
