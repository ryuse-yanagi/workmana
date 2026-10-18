<?php

namespace Tests\Feature\Tasks;

use App\Models\Task\Task;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ArchivedParentNestsChildTasksTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** アーカイブ一覧で子タスクが親の下にネストされる */
    public function test_archived_index_nests_child_tasks_under_parent(): void
    {
        [$user] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Archive nest'])
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

        $this->assertNotNull(Task::query()->find($parentId)?->archived_at);
        $this->assertNotNull(Task::query()->find($childId)?->archived_at);
        $this->assertSame($parentId, Task::query()->find($childId)?->parent_task_id);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/archived")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $parentId)
            ->assertJsonPath('data.0.archived_child_count', 1)
            ->assertJsonPath('data.0.archived_children.0.id', $childId);
    }

    /** 親の復元は、先にアーカイブした子も含めて戻す */
    public function test_restoring_parent_also_restores_child_that_was_archived_earlier(): void
    {
        [$user] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Archive restore'])
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

        $earlierChildId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Archived alone',
                'list_id' => $listId,
                'parent_task_id' => $parentId,
            ])
            ->assertCreated()
            ->json('id');

        $togetherChildId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Archived with parent',
                'list_id' => $listId,
                'parent_task_id' => $parentId,
            ])
            ->assertCreated()
            ->json('id');

        try {
            Carbon::setTestNow('2026-01-01 00:00:00');
            $this->actingAsApiUser($user)
                ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$earlierChildId}/archive")
                ->assertOk();

            Carbon::setTestNow('2026-01-02 00:00:00');
            $this->actingAsApiUser($user)
                ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$parentId}/archive")
                ->assertOk();

            $this->actingAsApiUser($user)
                ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$parentId}/unarchive")
                ->assertOk();
        } finally {
            Carbon::setTestNow();
        }

        $this->assertNull(Task::query()->find($parentId)?->archived_at);
        $this->assertNull(Task::query()->find($togetherChildId)?->archived_at);
        $earlier = Task::query()->find($earlierChildId);
        $this->assertNull($earlier?->archived_at);
        $this->assertSame($parentId, $earlier?->parent_task_id);
    }

    /** 先にアーカイブした子も親の行にまとめ、親を削除するとその子も消す */
    public function test_child_archived_earlier_nests_under_parent_and_is_deleted_with_parent(): void
    {
        [$user] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Archive separate'])
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

        $earlierChildId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Archived alone',
                'list_id' => $listId,
                'parent_task_id' => $parentId,
            ])
            ->assertCreated()
            ->json('id');

        $togetherChildId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Archived with parent',
                'list_id' => $listId,
                'parent_task_id' => $parentId,
            ])
            ->assertCreated()
            ->json('id');

        try {
            Carbon::setTestNow('2026-01-01 00:00:00');
            $this->actingAsApiUser($user)
                ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$earlierChildId}/archive")
                ->assertOk();

            Carbon::setTestNow('2026-01-02 00:00:00');
            $this->actingAsApiUser($user)
                ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$parentId}/archive")
                ->assertOk();

            $archived = $this->actingAsApiUser($user)
                ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/archived")
                ->assertOk()
                ->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.id', $parentId)
                ->assertJsonPath('data.0.archived_child_count', 2)
                ->json('data.0.archived_children');
            $childIds = collect($archived)->pluck('id')->all();
            $this->assertEqualsCanonicalizing([$togetherChildId, $earlierChildId], $childIds);

            $this->actingAsApiUser($user)
                ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$parentId}")
                ->assertNoContent();
        } finally {
            Carbon::setTestNow();
        }

        $this->assertNull(Task::withTrashed()->find($parentId));
        $this->assertNull(Task::withTrashed()->find($togetherChildId));
        $this->assertNull(Task::withTrashed()->find($earlierChildId));
    }
}
