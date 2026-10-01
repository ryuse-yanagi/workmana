<?php

namespace Tests\Feature\Tasks;

use App\Events\Task\TasksReordered;
use App\Models\Task\Task;
use App\Models\User;
use App\Models\Workspace\BoardList;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ReorderTasksBroadcastsEventTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** タスク並び替え時にイベントがブロードキャストされる */
    public function test_reorder_tasks_broadcasts_event(): void
    {
        Event::fake([TasksReordered::class]);

        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $listRes = $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/lists", [
                'name' => 'Todo',
                'color_index' => 0,
            ])
            ->assertCreated();

        $list = BoardList::query()->findOrFail($listRes->json('id'));

        $taskIds = [];
        foreach (['Alpha', 'Beta', 'Gamma'] as $title) {
            $res = $this->actingAsApiUser($user)
                ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                    'title' => $title,
                    'list_id' => $list->id,
                ])
                ->assertCreated();
            $taskIds[] = (int) $res->json('id');
        }

        $tasks = Task::query()->whereIn('id', $taskIds)->orderBy('id')->get()->all();
        $reorderedIds = array_reverse(array_map(fn (Task $task) => $task->id, $tasks));

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/lists/{$list->id}/tasks/reorder", [
                'task_ids' => $reorderedIds,
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        Event::assertDispatched(TasksReordered::class, function (TasksReordered $event) use ($workspace, $list, $reorderedIds) {
            return $event->workspaceId === (int) $workspace->id
                && $event->listId === (int) $list->id
                && $event->taskIds === $reorderedIds;
        });

        foreach ($reorderedIds as $index => $taskId) {
            $this->assertDatabaseHas('tasks', [
                'id' => $taskId,
                'list_id' => $list->id,
                'sort_order' => $index,
            ]);
        }
    }
}
