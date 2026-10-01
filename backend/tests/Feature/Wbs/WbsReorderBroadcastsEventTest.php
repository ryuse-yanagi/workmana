<?php

namespace Tests\Feature\Wbs;

use App\Events\Task\WbsTasksReordered;
use App\Models\Task\Task;
use App\Models\User;
use App\Models\Workspace\BoardList;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class WbsReorderBroadcastsEventTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** WBS並び替え時にイベントがブロードキャストされる */
    public function test_wbs_reorder_broadcasts_event(): void
    {
        Event::fake([WbsTasksReordered::class]);

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

        $payload = [];
        foreach (array_reverse($tasks) as $index => $task) {
            $payload[] = [
                'id' => $task->id,
                'sort_order' => $index,
                'parent_task_id' => null,
            ];
        }

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/wbs/reorder", [
                'tasks' => $payload,
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        Event::assertDispatched(WbsTasksReordered::class, function (WbsTasksReordered $event) use ($workspace, $payload) {
            return $event->workspaceId === (int) $workspace->id
                && $event->tasks === $payload;
        });

        foreach ($payload as $item) {
            $this->assertDatabaseHas('tasks', [
                'id' => $item['id'],
                'sort_order' => $item['sort_order'],
                'parent_task_id' => $item['parent_task_id'],
            ]);
        }
    }
}
