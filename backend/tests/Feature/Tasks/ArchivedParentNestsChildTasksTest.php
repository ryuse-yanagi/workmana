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

    /** 親の復元は、親と一緒にアーカイブした子だけ戻す */
    public function test_restoring_parent_keeps_child_that_was_archived_earlier(): void
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
        $this->assertNotNull(Task::query()->find($earlierChildId)?->archived_at);
    }
}
