<?php

namespace Tests\Feature\Notifications;

use App\Enums\MembershipRole;
use App\Models\AppNotification;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AssigningTaskCreatesNotificationTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_assigning_task_creates_notification(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Notify space'])
            ->assertCreated()
            ->json('id');

        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $this->syncWorkspaceAssigneesViaApi($admin, 'acme', $workspaceId, [$member->id]);

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Please do this',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated();

        $this->assertTrue(
            AppNotification::query()
                ->where('user_id', $member->id)
                ->where('type', 'task.assigned')
                ->exists()
        );

        $this->actingAsApiUser($member)
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'task.assigned');
    }

    public function test_self_assigning_task_does_not_notify_actor(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Notify space'])
            ->assertCreated()
            ->json('id');

        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $this->syncWorkspaceAssigneesViaApi($admin, 'acme', $workspaceId, [$admin->id]);

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Assigned to myself',
                'list_id' => $listId,
                'assignee_ids' => [$admin->id],
            ])
            ->assertCreated();

        $this->assertFalse(
            AppNotification::query()
                ->where('user_id', $admin->id)
                ->where('type', 'task.assigned')
                ->exists()
        );
    }
}
