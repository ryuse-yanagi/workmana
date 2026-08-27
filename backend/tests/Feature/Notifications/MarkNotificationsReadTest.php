<?php

namespace Tests\Feature\Notifications;

use App\Models\AppNotification;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MarkNotificationsReadTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_notifications_can_be_marked_read(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Files'])
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

        $readAt = $this->actingAsApiUser($member)
            ->patchJson("/api/notifications/{$notificationId}/read")
            ->assertOk()
            ->json('read_at');
        $this->assertNotEmpty($readAt);

        $this->actingAsApiUser($member)
            ->postJson('/api/notifications/read-all')
            ->assertOk();

        $this->assertSame($organization->slug, 'acme');
    }
}
