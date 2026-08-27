<?php

namespace Tests\Feature\BoardLists;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ListDeleteMovesTasksToOtherListTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_list_delete_moves_tasks_to_other_list_by_list_id(): void
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

        $workspace = Workspace::query()->firstOrFail();
        $lists = $workspace->lists()->orderBy('sort_order')->get();
        $this->assertGreaterThanOrEqual(2, $lists->count());
        $firstList = $lists[0];
        $secondList = $lists[1];

        $taskId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Move on delete',
                'list_id' => $secondList->id,
            ])
            ->assertCreated()
            ->assertJsonPath('list_id', $secondList->id)
            ->json('id');

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}/lists/{$secondList->id}")
            ->assertNoContent();

        $task = Task::query()->findOrFail($taskId);
        $this->assertSame((int) $firstList->id, (int) $task->list_id);
    }
}
