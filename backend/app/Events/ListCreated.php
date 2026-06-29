<?php

namespace App\Events;

use App\Models\BoardList;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ListCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public BoardList $list) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("workspaces.{$this->list->workspace_id}")];
    }

    public function broadcastAs(): string
    {
        return 'ListCreated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'list' => [
                'id' => $this->list->id,
                'name' => $this->list->name,
                'color_index' => $this->list->color_index,
                'sort_order' => $this->list->sort_order,
            ],
        ];
    }
}
