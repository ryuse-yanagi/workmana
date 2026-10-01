<?php

namespace Tests\Feature\Wbs;

use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ChangingTaskListPreservesWbsSortOrderTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** リスト移動は WBS の sort_order を変えない（並び替えはドラッグ専用） */
    public function test_changing_task_list_preserves_wbs_sort_order(): void
    {
        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->first();
        $this->assertNotNull($workspace);

        $lists = $workspace->lists()->orderBy('sort_order')->get();
        $this->assertGreaterThanOrEqual(2, $lists->count());
        $firstList = $lists[0];
        $secondList = $lists[1];

        $taskA = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Task A',
                'list_id' => $firstList->id,
            ])
            ->assertCreated()
            ->json('id');

        $taskB = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Task B',
                'list_id' => $secondList->id,
            ])
            ->assertCreated()
            ->json('id');

        $taskC = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Task C',
                'list_id' => $firstList->id,
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/wbs/reorder", [
                'tasks' => [
                    ['id' => $taskA, 'sort_order' => 0, 'parent_task_id' => null],
                    ['id' => $taskB, 'sort_order' => 1, 'parent_task_id' => null],
                    ['id' => $taskC, 'sort_order' => 2, 'parent_task_id' => null],
                ],
            ])
            ->assertOk();

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskB}", [
                'list_id' => $firstList->id,
            ])
            ->assertOk()
            ->assertJsonPath('list_id', $firstList->id)
            ->assertJsonPath('sort_order', 1);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('data.0.id', $taskA)
            ->assertJsonPath('data.1.id', $taskB)
            ->assertJsonPath('data.2.id', $taskC);
    }
}
