<?php

namespace Tests\Feature\Tasks;

use App\Models\Task\Task;
use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MovingTaskToListChangesListIdTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** リスト移動は list_id だけ変え、WBS の sort_order は維持する */
    public function test_moving_task_to_list_only_changes_list_id(): void
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

        $create = $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Ship it',
                'list_id' => $firstList->id,
            ])
            ->assertCreated()
            ->assertJsonPath('list_id', $firstList->id);

        $taskId = (int) $create->json('id');
        $originalSortOrder = (int) Task::query()->findOrFail($taskId)->sort_order;

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskId}", [
                'list_id' => $secondList->id,
            ])
            ->assertOk()
            ->assertJsonPath('list_id', $secondList->id)
            ->assertJsonPath('sort_order', $originalSortOrder);

        $moved = Task::query()->findOrFail($taskId);
        $this->assertSame((int) $secondList->id, (int) $moved->list_id);
        $this->assertSame($originalSortOrder, (int) $moved->sort_order);
    }
}
