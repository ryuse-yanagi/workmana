<?php

namespace Tests\Feature\Notifications;

use App\Enums\MembershipRole;
use App\Models\Notification\AppNotification;
use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AssigningTaskCreatesNotificationTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** タスク担当者の指定で通知が作成される */
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

        $assigned = AppNotification::query()
            ->where('user_id', $member->id)
            ->where('type', 'task.assigned')
            ->first();
        $this->assertNotNull($assigned);
        $this->assertSame('Notify space', $assigned->data['workspace_name'] ?? null);
        $this->assertNull($assigned->data['parent_task_title'] ?? null);

        $types = collect(
            $this->actingAsApiUser($member)
                ->getJson('/api/notifications')
                ->assertOk()
                ->json('data')
        )->pluck('type');
        $this->assertTrue($types->contains('task.assigned'));
        $this->assertTrue($types->contains('workspace.member_added'));
    }

    /** 自分自身を担当者にしても通知されない */
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
