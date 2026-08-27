<?php

namespace Tests\Feature\Wbs;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ReorderWbsTasksTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_user_can_reorder_wbs_tasks(): void
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

        $listId = $this->defaultListId($workspace);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Parent task',
                'list_id' => $listId,
                'is_parent_task' => true,
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Child task',
                'list_id' => $listId,
                'parent_task_id' => 1,
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Standalone task',
                'list_id' => $listId,
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/wbs/reorder", [
                'tasks' => [
                    ['id' => 3, 'sort_order' => 0, 'parent_task_id' => null],
                    ['id' => 1, 'sort_order' => 1, 'parent_task_id' => null],
                    ['id' => 2, 'sort_order' => 2, 'parent_task_id' => 1],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('data.0.id', 3)
            ->assertJsonPath('data.1.id', 1)
            ->assertJsonPath('data.2.id', 2)
            ->assertJsonPath('data.2.parent_task_id', 1);
    }
}
