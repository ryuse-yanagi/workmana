<?php

namespace Tests\Feature;

use App\Events\ListsReordered;
use App\Events\TasksReordered;
use App\Models\BoardList;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ProjectRealtimeBroadcastTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: Project, 2: BoardList, 3: array<int, Task>} */
    private function seedBoardContext(): array
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/projects', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $project = Project::query()->firstOrFail();

        $listRes = $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/lists", [
                'name' => 'Todo',
            ])
            ->assertCreated();

        $list = BoardList::query()->findOrFail($listRes->json('id'));

        $taskIds = [];
        foreach (['Alpha', 'Beta', 'Gamma'] as $title) {
            $res = $this->withHeader('Authorization', 'Bearer '.$user->id)
                ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                    'title' => $title,
                    'list_id' => $list->id,
                    'status' => 'todo',
                ])
                ->assertCreated();
            $taskIds[] = (int) $res->json('id');
        }

        $tasks = Task::query()->whereIn('id', $taskIds)->orderBy('id')->get()->all();

        return [$user, $project, $list, $tasks];
    }

    public function test_reorder_tasks_broadcasts_event(): void
    {
        Event::fake([TasksReordered::class]);

        [$user, $project, $list, $tasks] = $this->seedBoardContext();
        $reorderedIds = array_reverse(array_map(fn (Task $task) => $task->id, $tasks));

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/lists/{$list->id}/tasks/reorder", [
                'task_ids' => $reorderedIds,
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        Event::assertDispatched(TasksReordered::class, function (TasksReordered $event) use ($project, $list, $reorderedIds) {
            return $event->projectId === (int) $project->id
                && $event->listId === (int) $list->id
                && $event->taskIds === $reorderedIds;
        });
    }

    public function test_reorder_lists_broadcasts_event(): void
    {
        Event::fake([ListsReordered::class]);

        [$user, $project] = $this->seedBoardContext();

        $listB = $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/lists", [
                'name' => 'Doing',
            ])
            ->assertCreated()
            ->json('id');

        $listIds = [(int) $listB, ...BoardList::query()
            ->where('project_id', $project->id)
            ->where('id', '!=', $listB)
            ->pluck('id')
            ->all()];

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/lists/reorder", [
                'list_ids' => $listIds,
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        Event::assertDispatched(ListsReordered::class, function (ListsReordered $event) use ($project, $listIds) {
            return $event->projectId === (int) $project->id
                && $event->listIds === $listIds;
        });
    }
}
