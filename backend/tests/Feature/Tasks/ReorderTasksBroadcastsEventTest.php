<?php

namespace Tests\Feature\Tasks;

use App\Events\TasksReordered;
use App\Models\BoardList;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ReorderTasksBroadcastsEventTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_reorder_tasks_broadcasts_event(): void
    {
        Event::fake([TasksReordered::class]);

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

        $listRes = $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/lists", [
                'name' => 'Todo',
                'color_index' => 0,
            ])
            ->assertCreated();

        $list = BoardList::query()->findOrFail($listRes->json('id'));

        $taskIds = [];
        foreach (['Alpha', 'Beta', 'Gamma'] as $title) {
            $res = $this->actingAsApiUser($user)
                ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                    'title' => $title,
                    'list_id' => $list->id,
                ])
                ->assertCreated();
            $taskIds[] = (int) $res->json('id');
        }

        $tasks = Task::query()->whereIn('id', $taskIds)->orderBy('id')->get()->all();
        $reorderedIds = array_reverse(array_map(fn (Task $task) => $task->id, $tasks));

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/lists/{$list->id}/tasks/reorder", [
                'task_ids' => $reorderedIds,
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        Event::assertDispatched(TasksReordered::class, function (TasksReordered $event) use ($workspace, $list, $reorderedIds) {
            return $event->workspaceId === (int) $workspace->id
                && $event->listId === (int) $list->id
                && $event->taskIds === $reorderedIds;
        });
    }
}
