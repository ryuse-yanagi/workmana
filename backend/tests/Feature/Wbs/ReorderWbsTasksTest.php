<?php

namespace Tests\Feature\Wbs;

use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ReorderWbsTasksTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** WBS並び替えは全アクティブタスクを含め、DBの sort_order / parent も更新する */
    public function test_user_can_reorder_wbs_tasks(): void
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

        $listId = $this->defaultListId($workspace);

        $parentId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Parent task',
                'list_id' => $listId,
                'is_parent_task' => true,
            ])
            ->assertCreated()
            ->json('id');

        $childId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Child task',
                'list_id' => $listId,
                'parent_task_id' => $parentId,
            ])
            ->assertCreated()
            ->json('id');

        $standaloneId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Standalone task',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/wbs/reorder", [
                'tasks' => [
                    ['id' => $standaloneId, 'sort_order' => 0, 'parent_task_id' => null],
                    ['id' => $parentId, 'sort_order' => 1, 'parent_task_id' => null],
                    ['id' => $childId, 'sort_order' => 2, 'parent_task_id' => $parentId],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        $this->assertDatabaseHas('tasks', ['id' => $standaloneId, 'sort_order' => 0, 'parent_task_id' => null]);
        $this->assertDatabaseHas('tasks', ['id' => $parentId, 'sort_order' => 1, 'parent_task_id' => null]);
        $this->assertDatabaseHas('tasks', ['id' => $childId, 'sort_order' => 2, 'parent_task_id' => $parentId]);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('data.0.id', $standaloneId)
            ->assertJsonPath('data.1.id', $parentId)
            ->assertJsonPath('data.2.id', $childId)
            ->assertJsonPath('data.2.parent_task_id', $parentId);
    }

    /** 一部のタスクだけ送ると 422。抜け漏れで親子関係が壊れないようにするため */
    public function test_wbs_reorder_rejects_incomplete_task_set(): void
    {
        [$user] = $this->createOrgWithAdmin();
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Sprint 1');
        $listId = $this->defaultListId(Workspace::query()->findOrFail($workspaceId));

        $firstId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'A',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');
        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'B',
                'list_id' => $listId,
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/wbs/reorder", [
                'tasks' => [
                    ['id' => $firstId, 'sort_order' => 0, 'parent_task_id' => null],
                ],
            ])
            ->assertUnprocessable();
    }
}
