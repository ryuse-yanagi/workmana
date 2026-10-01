<?php

namespace App\Events\Workspace;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** スペースメンバーの変更を、そのスペースのプライベートチャンネルへ即時配信する。 */
class WorkspaceMembersUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  list<array<string, mixed>>  $members
     * @param  list<int>  $removedMemberIds
     */
    public function __construct(
        public int $workspaceId,
        public array $members,
        public array $removedMemberIds = [],
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("workspaces.{$this->workspaceId}")];
    }

    public function broadcastAs(): string
    {
        return 'WorkspaceMembersUpdated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'members' => $this->members,
            'removed_member_ids' => $this->removedMemberIds,
        ];
    }
}
