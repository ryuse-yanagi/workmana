<?php

namespace Tests\Feature\Notifications;

use App\Enums\MembershipRole;
use App\Models\Notification\AppNotification;
use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class OperationNotificationsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** スペース作成時に、操作者以外のメンバーへ通知する */
    public function test_creating_workspace_notifies_added_members(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Shared space',
                'assignee_ids' => [$admin->id, $member->id],
            ])
            ->assertCreated()
            ->json('id');

        $this->assertDatabaseHas('app_notifications', [
            'user_id' => $member->id,
            'type' => 'workspace.member_added',
        ]);
        $this->assertFalse(
            AppNotification::query()
                ->where('user_id', $admin->id)
                ->where('type', 'workspace.member_added')
                ->exists()
        );

        $notification = AppNotification::query()->where('user_id', $member->id)->first();
        $this->assertSame($workspaceId, $notification?->data['workspace_id'] ?? null);
        $this->assertSame('Shared space', $notification?->data['workspace_name'] ?? null);
    }

    /** 既存の担当者だけに、期限の設定・変更・削除を通知する */
    public function test_due_date_changes_notify_existing_assignees_only(): void
    {
        [$admin, $organization, $member, $workspaceId, $listId] = $this->workspaceWithMember();

        $other = User::factory()->create();
        $organization->members()->attach($other->id, ['role' => MembershipRole::Member->value]);
        $this->syncWorkspaceAssigneesViaApi($admin, 'acme', $workspaceId, [$member->id, $other->id]);

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Dated task',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}", [
                'due_date' => '2026-10-01',
                'assignee_ids' => [$member->id, $other->id],
            ])
            ->assertOk();

        $this->assertDatabaseHas('app_notifications', [
            'user_id' => $member->id,
            'type' => 'task.due_date_changed',
        ]);
        $due = AppNotification::query()
            ->where('user_id', $member->id)
            ->where('type', 'task.due_date_changed')
            ->first();
        $this->assertSame('set', $due?->data['due_date_change'] ?? null);
        $this->assertSame('2026-10-01', $due?->data['due_date'] ?? null);
        $this->assertSame('Notify space', $due?->data['workspace_name'] ?? null);
        $this->assertNull($due?->data['parent_task_title'] ?? null);

        $this->assertFalse(
            AppNotification::query()
                ->where('user_id', $other->id)
                ->where('type', 'task.due_date_changed')
                ->exists()
        );
        $this->assertTrue(
            AppNotification::query()
                ->where('user_id', $other->id)
                ->where('type', 'task.assigned')
                ->exists()
        );

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}", [
                'due_date' => '2026-10-08',
            ])
            ->assertOk();

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}", [
                'due_date' => null,
            ])
            ->assertOk();

        $changes = AppNotification::query()
            ->where('user_id', $member->id)
            ->where('type', 'task.due_date_changed')
            ->orderBy('id')
            ->get()
            ->map(fn (AppNotification $row) => $row->data['due_date_change'] ?? null)
            ->all();
        $this->assertSame(['set', 'changed', 'cleared'], $changes);
    }

    /** 担当タスクのアーカイブ、復元、完全削除を通知する */
    public function test_archive_restore_and_delete_notify_assignees(): void
    {
        [$admin, , $member, $workspaceId, $listId] = $this->workspaceWithMember();

        $parentId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Parent',
                'list_id' => $listId,
                'is_parent_task' => true,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Child',
                'list_id' => $listId,
                'parent_task_id' => $parentId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated();

        $childAssigned = AppNotification::query()
            ->where('user_id', $member->id)
            ->where('type', 'task.assigned')
            ->get()
            ->first(fn (AppNotification $row) => ($row->data['title'] ?? null) === 'Child');
        $this->assertSame('Notify space', $childAssigned?->data['workspace_name'] ?? null);
        $this->assertSame('Parent', $childAssigned?->data['parent_task_title'] ?? null);

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$parentId}/archive")
            ->assertOk();

        $archived = AppNotification::query()
            ->where('user_id', $member->id)
            ->where('type', 'task.archived')
            ->get();
        $this->assertCount(2, $archived);
        $archivedChild = $archived->first(fn (AppNotification $row) => ($row->data['title'] ?? null) === 'Child');
        $this->assertSame('Notify space', $archivedChild?->data['workspace_name'] ?? null);
        $this->assertSame('Parent', $archivedChild?->data['parent_task_title'] ?? null);

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$parentId}/unarchive")
            ->assertOk();

        $this->assertSame(
            2,
            AppNotification::query()
                ->where('user_id', $member->id)
                ->where('type', 'task.restored')
                ->count()
        );

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$parentId}/archive")
            ->assertOk();
        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$parentId}")
            ->assertNoContent();

        $deleted = AppNotification::query()
            ->where('user_id', $member->id)
            ->where('type', 'task.deleted')
            ->get();
        $this->assertCount(2, $deleted);
        $deletedChild = $deleted->first(fn (AppNotification $row) => ($row->data['title'] ?? null) === 'Child');
        $this->assertSame('Notify space', $deletedChild?->data['workspace_name'] ?? null);
        $this->assertSame('Parent', $deletedChild?->data['parent_task_title'] ?? null);
        $this->assertFalse(
            AppNotification::query()
                ->where('user_id', $admin->id)
                ->where('type', 'task.deleted')
                ->exists()
        );
    }

    /** 役割が変わった本人にだけ通知する */
    public function test_role_change_notifies_the_member(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/members/{$member->id}", ['role' => 'member'])
            ->assertOk();

        $this->assertFalse(
            AppNotification::query()
                ->where('user_id', $member->id)
                ->where('type', 'organization.role_changed')
                ->exists()
        );

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/members/{$member->id}", ['role' => 'admin'])
            ->assertOk();

        $notification = AppNotification::query()
            ->where('user_id', $member->id)
            ->where('type', 'organization.role_changed')
            ->first();
        $this->assertSame('admin', $notification?->data['role'] ?? null);
        $this->assertSame('acme', $notification?->data['organization_slug'] ?? null);
    }

    /** アカウントを持つ招待先には、メールに加えてアプリ内通知を作る */
    public function test_invite_notifies_existing_user_and_skips_unknown_email(): void
    {
        Mail::fake();
        [$admin] = $this->createOrgWithAdmin();
        $existing = User::factory()->create(['email' => 'already@example.com']);

        $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'Already@Example.com',
                'role' => 'member',
            ])
            ->assertCreated();

        $notification = AppNotification::query()
            ->where('user_id', $existing->id)
            ->where('type', 'organization.invited')
            ->first();
        $this->assertNotNull($notification);
        $this->assertSame('acme', $notification->data['organization_slug'] ?? null);
        $this->assertIsString($notification->data['invite_token'] ?? null);
        $this->assertNotSame('', $notification->data['invite_token']);

        $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'nobody@example.com',
                'role' => 'member',
            ])
            ->assertCreated();

        $this->assertSame(
            1,
            AppNotification::query()->where('type', 'organization.invited')->count()
        );
    }

    /**
     * @return array{0: User, 1: \App\Models\Organization\Organization, 2: User, 3: int, 4: int}
     */
    private function workspaceWithMember(): array
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

        return [$admin, $organization, $member, $workspaceId, $listId];
    }
}
