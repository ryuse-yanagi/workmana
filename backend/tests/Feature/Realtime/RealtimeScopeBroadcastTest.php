<?php

namespace Tests\Feature\Realtime;

use App\Events\Organization\OrganizationChanged;
use App\Events\Task\TaskDeleted;
use App\Events\Task\TaskUpdated;
use App\Models\Organization\Organization;
use App\Models\Task\Task;
use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class RealtimeScopeBroadcastTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** チェックリストと、親解除で外れた子はタスク更新イベントに載る */
    public function test_task_update_broadcasts_checklists_and_detached_children(): void
    {
        Event::fake([TaskUpdated::class]);

        $user = User::factory()->create();
        $slug = $this->createOrganizationViaApi($user);
        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", ['name' => 'Sprint'])
            ->assertCreated();
        $workspace = Workspace::query()->firstOrFail();
        $listId = $this->defaultListId($workspace);

        $parentId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Parent',
                'list_id' => $listId,
                'is_parent_task' => true,
            ])
            ->assertCreated()
            ->json('id');
        $childId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Child',
                'list_id' => $listId,
                'parent_task_id' => $parentId,
            ])
            ->assertCreated()
            ->json('id');

        $itemId = '11111111-1111-4111-8111-111111111111';
        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$parentId}", [
                'is_parent_task' => false,
                'checklists' => [[
                    'title' => 'Release prep',
                    'items' => [[
                        'id' => $itemId,
                        'text' => 'Review',
                        'checked' => true,
                    ]],
                ]],
            ])
            ->assertOk();

        Event::assertDispatched(TaskUpdated::class, function (TaskUpdated $event) use ($parentId, $childId, $itemId) {
            $payload = $event->broadcastWith();

            return (int) ($payload['task']['id'] ?? 0) === $parentId
                && ($payload['task']['checklists'][0]['title'] ?? null) === 'Release prep'
                && ($payload['task']['checklists'][0]['items'][0]['id'] ?? null) === $itemId
                && ($payload['task']['checklists'][0]['items'][0]['checked'] ?? null) === true
                && $payload['detached_child_ids'] === [$childId];
        });

        $this->assertNull(Task::query()->find($childId)?->parent_task_id);
    }

    /** 親の完全削除は、一緒に消える子の ID も配信する */
    public function test_task_delete_broadcasts_cascaded_child_ids(): void
    {
        Event::fake([TaskDeleted::class]);

        [$user] = $this->createOrgWithAdmin();
        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Space'])
            ->assertCreated();
        $workspace = Workspace::query()->firstOrFail();
        $listId = $this->defaultListId($workspace);
        $parentId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Parent',
                'list_id' => $listId,
                'is_parent_task' => true,
            ])
            ->assertCreated()
            ->json('id');
        $childId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Child',
                'list_id' => $listId,
                'parent_task_id' => $parentId,
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$parentId}/archive")
            ->assertOk();
        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$parentId}")
            ->assertNoContent();

        Event::assertDispatched(TaskDeleted::class, function (TaskDeleted $event) use ($parentId, $childId) {
            $payload = $event->broadcastWith();

            return $payload['id'] === $parentId
                && $payload['cascaded_task_ids'] === [$childId];
        });
    }

    /** スペース、資料、設定、プロフィール、ラベルは組織チャンネルへ配信する */
    public function test_organization_channel_covers_previously_unsynced_changes(): void
    {
        Event::fake([OrganizationChanged::class]);

        $user = User::factory()->create(['name' => 'Before']);
        $slug = $this->createOrganizationViaApi($user, 'Acme');
        $organization = Organization::query()->where('slug', $slug)->firstOrFail();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", ['name' => 'Space'])
            ->assertCreated();
        $workspace = Workspace::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}", ['name' => 'Renamed'])
            ->assertOk();
        Event::assertDispatched(OrganizationChanged::class, function (OrganizationChanged $event) use ($organization) {
            return $event->organizationId === (int) $organization->id
                && $event->type === 'workspace.updated'
                && ($event->broadcastWith()['workspace']['name'] ?? null) === 'Renamed';
        });

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/pin")
            ->assertOk();
        Event::assertDispatched(OrganizationChanged::class, function (OrganizationChanged $event) use ($user, $workspace) {
            $payload = $event->broadcastWith();

            return $event->type === 'workspace.pinned'
                && ($payload['user_id'] ?? null) === (int) $user->id
                && ($payload['workspace_id'] ?? null) === (int) $workspace->id
                && ($payload['pinned'] ?? null) === true;
        });

        $documentId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/documents", ['name' => 'Spec'])
            ->assertCreated()
            ->json('id');
        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/documents/{$documentId}", ['name' => 'Spec v2'])
            ->assertOk();
        Event::assertDispatched(OrganizationChanged::class, fn (OrganizationChanged $event) => $event->type === 'document.updated'
            && ($event->broadcastWith()['document']['name'] ?? null) === 'Spec v2');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/settings", ['name' => 'Acme Inc'])
            ->assertOk();
        Event::assertDispatched(OrganizationChanged::class, fn (OrganizationChanged $event) => $event->type === 'settings.updated'
            && ($event->broadcastWith()['settings']['name'] ?? null) === 'Acme Inc');

        $categoryId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/task-label-categories", ['name' => 'Priority'])
            ->assertCreated()
            ->json('id');
        Event::assertDispatched(OrganizationChanged::class, fn (OrganizationChanged $event) => $event->type === 'task_labels.updated'
            && ($event->broadcastWith()['categories'][0]['name'] ?? null) === 'Priority'
            && ($event->broadcastWith()['categories'][0]['id'] ?? null) === $categoryId);

        $this->actingAsApiUser($user)
            ->patchJson('/api/me', ['name' => 'After'])
            ->assertOk();
        Event::assertDispatched(OrganizationChanged::class, fn (OrganizationChanged $event) => $event->type === 'user.profile_updated'
            && ($event->broadcastWith()['user']['name'] ?? null) === 'After');
    }
}
