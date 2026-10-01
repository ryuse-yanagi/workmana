<?php

namespace Tests\Feature\BoardLists;

use App\Models\Task\Task;
use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ListDeleteMovesTasksToOtherListTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** リスト削除時、タスクはリクエストで指定せず sort_order 最小の残リストへ移る */
    public function test_list_delete_moves_tasks_to_remaining_list_with_lowest_sort_order(): void
    {
        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();
        $lists = $workspace->lists()->orderBy('sort_order')->get();
        $this->assertGreaterThanOrEqual(2, $lists->count());
        $firstList = $lists[0];
        $secondList = $lists[1];

        $taskId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Move on delete',
                'list_id' => $secondList->id,
            ])
            ->assertCreated()
            ->assertJsonPath('list_id', $secondList->id)
            ->json('id');

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/lists/{$secondList->id}")
            ->assertNoContent();

        $task = Task::query()->findOrFail($taskId);
        $this->assertSame((int) $firstList->id, (int) $task->list_id);
    }

    /** 最後の1リストは削除できない */
    public function test_cannot_delete_the_last_list_in_a_workspace(): void
    {
        [$user] = $this->createOrgWithAdmin();
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Sprint 1');
        $workspace = Workspace::query()->findOrFail($workspaceId);
        $lists = $workspace->lists()->orderBy('sort_order')->get();
        $this->assertGreaterThanOrEqual(2, $lists->count());

        foreach ($lists->slice(1) as $list) {
            $this->actingAsApiUser($user)
                ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}/lists/{$list->id}")
                ->assertNoContent();
        }

        $lastListId = (int) $workspace->lists()->value('id');
        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}/lists/{$lastListId}")
            ->assertUnprocessable();

        $this->assertDatabaseHas('lists', ['id' => $lastListId, 'workspace_id' => $workspaceId]);
    }
}
