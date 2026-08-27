<?php

namespace Tests\Feature\Wbs;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ChangingTaskListPreservesWbsSortOrderTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_changing_task_list_preserves_wbs_sort_order(): void
    {
        $user = User::factory()->create();

        $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->first();
        $this->assertNotNull($workspace);

        $lists = $workspace->lists()->orderBy('sort_order')->get();
        $this->assertGreaterThanOrEqual(2, $lists->count());
        $firstList = $lists[0];
        $secondList = $lists[1];

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Task A',
                'list_id' => $firstList->id,
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Task B',
                'list_id' => $secondList->id,
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Task C',
                'list_id' => $firstList->id,
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/wbs/reorder", [
                'tasks' => [
                    ['id' => 1, 'sort_order' => 0, 'parent_task_id' => null],
                    ['id' => 2, 'sort_order' => 1, 'parent_task_id' => null],
                    ['id' => 3, 'sort_order' => 2, 'parent_task_id' => null],
                ],
            ])
            ->assertOk();

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/2", [
                'list_id' => $firstList->id,
            ])
            ->assertOk()
            ->assertJsonPath('list_id', $firstList->id)
            ->assertJsonPath('sort_order', 1);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.1.id', 2)
            ->assertJsonPath('data.2.id', 3);
    }
}
