<?php

namespace App\Events\Task;

use App\Models\Task\Task;
use App\Support\Task\TaskBoardBroadcast;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** タスクの更新を、そのスペースのプライベートチャンネルへ即時配信する。 */
class TaskUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Task $task) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("workspaces.{$this->task->workspace_id}")];
    }

    public function broadcastAs(): string
    {
        return 'TaskUpdated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'task' => TaskBoardBroadcast::taskDetailPayload($this->task),
        ];
    }
}
