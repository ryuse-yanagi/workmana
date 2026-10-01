<?php

namespace Tests\Feature\Notifications;

use App\Models\Notification\AppNotification;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MarkNotificationsReadTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 個別既読と一括既読で、自分の通知だけ read_at が入る */
    public function test_notifications_can_be_marked_read(): void
    {
        [$admin, , $member] = $this->createOrgWithAdminAndMember();

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Files',
                'assignee_ids' => [$admin->id, $member->id],
            ])
            ->assertCreated()
            ->json('id');
        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'With file',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated();

        $notificationId = (int) AppNotification::query()
            ->where('user_id', $member->id)
            ->where('type', 'task.assigned')
            ->value('id');
        $this->assertGreaterThan(0, $notificationId);

        $second = AppNotification::query()->create([
            'user_id' => $member->id,
            'type' => 'task.assigned',
            'data' => ['title' => 'Another'],
        ]);

        $otherUserNotification = AppNotification::query()->create([
            'user_id' => $admin->id,
            'type' => 'task.assigned',
            'data' => ['title' => 'Admin only'],
        ]);

        $readAt = $this->actingAsApiUser($member)
            ->patchJson("/api/notifications/{$notificationId}/read")
            ->assertOk()
            ->json('read_at');
        $this->assertNotEmpty($readAt);

        $this->actingAsApiUser($member)
            ->patchJson("/api/notifications/{$otherUserNotification->id}/read")
            ->assertNotFound();

        $this->actingAsApiUser($member)
            ->postJson('/api/notifications/read-all')
            ->assertOk();

        $this->assertNotNull(AppNotification::query()->findOrFail($notificationId)->read_at);
        $this->assertNotNull($second->fresh()->read_at);
        $this->assertNull($otherUserNotification->fresh()->read_at);
    }
}
