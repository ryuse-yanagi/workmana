<?php

namespace App\Events\Organization;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** 組織全体に関わる変更を、その組織のプライベートチャンネルへ即時配信する。 */
class OrganizationChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public int $organizationId,
        public string $type,
        public array $data = [],
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("organizations.{$this->organizationId}")];
    }

    public function broadcastAs(): string
    {
        return 'OrganizationChanged';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return array_merge(['type' => $this->type], $this->data);
    }
}
