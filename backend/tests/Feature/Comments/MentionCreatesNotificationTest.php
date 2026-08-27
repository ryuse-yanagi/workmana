<?php

namespace Tests\Feature\Comments;

use App\Enums\MembershipRole;
use App\Models\AppNotification;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MentionCreatesNotificationTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_mention_creates_notification_for_org_members_only(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Notify space'])
            ->assertCreated()
            ->json('id');

        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Please do this',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/comments", [
                'body' => 'Hello @[Admin](user:'.$admin->id.')',
            ])
            ->assertCreated();

        $this->assertTrue(
            AppNotification::query()
                ->where('user_id', $admin->id)
                ->where('type', 'task.mentioned')
                ->exists()
        );

        $outsider = User::factory()->create();
        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/comments", [
                'body' => 'Ping @[Outsider](user:'.$outsider->id.')',
            ])
            ->assertCreated();

        $this->assertFalse(
            AppNotification::query()
                ->where('user_id', $outsider->id)
                ->where('type', 'task.mentioned')
                ->exists()
        );
    }

    public function test_all_mention_notifies_all_workspace_members(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);
        $outsider = User::factory()->create();

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'All mention space'])
            ->assertCreated()
            ->json('id');

        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Notify everyone',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/comments", [
                'body' => 'Hello @[all]',
            ])
            ->assertCreated();

        $this->assertTrue(
            AppNotification::query()
                ->where('user_id', $member->id)
                ->where('type', 'task.mentioned')
                ->exists()
        );

        $this->assertFalse(
            AppNotification::query()
                ->where('user_id', $admin->id)
                ->where('type', 'task.mentioned')
                ->exists()
        );

        $this->assertFalse(
            AppNotification::query()
                ->where('user_id', $outsider->id)
                ->where('type', 'task.mentioned')
                ->exists()
        );
    }
}
