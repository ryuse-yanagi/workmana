<?php

namespace Tests\Feature\Tasks;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MovingTaskToListChangesListIdTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_moving_task_to_list_only_changes_list_id(): void
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

        $create = $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Ship it',
                'list_id' => $firstList->id,
            ])
            ->assertCreated()
            ->assertJsonPath('list_id', $firstList->id);

        $taskId = (int) $create->json('id');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$taskId}", [
                'list_id' => $secondList->id,
            ])
            ->assertOk()
            ->assertJsonPath('list_id', $secondList->id);

        $this->assertSame((int) $secondList->id, (int) Task::query()->findOrFail($taskId)->list_id);

        $this->assertDatabaseHas('task_histories', [
            'task_id' => $taskId,
            'event_type' => 'list_changed',
            'field_name' => 'list_id',
        ]);
        $this->assertDatabaseMissing('task_histories', [
            'task_id' => $taskId,
            'event_type' => 'status_changed',
        ]);
    }
}
