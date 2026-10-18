<?php

namespace App\Events\Task;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** タスク添付の追加を、そのスペースのプライベートチャンネルへ即時配信する。 */
class TaskAttachmentAdded implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, mixed>  $attachment
     */
    public function __construct(
        public int $workspaceId,
        public array $attachment,
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("workspaces.{$this->workspaceId}")];
    }

    public function broadcastAs(): string
    {
        return 'TaskAttachmentAdded';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['attachment' => $this->attachment];
    }
}
