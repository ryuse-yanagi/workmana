<?php

namespace Tests\Feature\Wbs;

use App\Events\WbsTasksReordered;
use App\Models\BoardList;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class WbsReorderBroadcastsEventTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_wbs_reorder_broadcasts_event(): void
    {
        Event::fake([WbsTasksReordered::class]);

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

        $payload = [];
        foreach (array_reverse($tasks) as $index => $task) {
            $payload[] = [
                'id' => $task->id,
                'sort_order' => $index,
                'parent_task_id' => null,
            ];
        }

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/wbs/reorder", [
                'tasks' => $payload,
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        Event::assertDispatched(WbsTasksReordered::class, function (WbsTasksReordered $event) use ($workspace, $payload) {
            return $event->workspaceId === (int) $workspace->id
                && $event->tasks === $payload;
        });
    }
}
