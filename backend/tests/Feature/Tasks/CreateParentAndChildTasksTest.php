<?php

namespace Tests\Feature\Tasks;

use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CreateParentAndChildTasksTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 親タスクを作ったあと、そのIDを指定して子タスクを作れる */
    public function test_user_can_create_parent_and_child_tasks(): void
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
            ->assertJsonPath('title', 'Parent task')
            ->assertJsonPath('is_parent_task', true)
            ->assertJsonPath('parent_task_id', null)
            ->json('id');

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/parents")
            ->assertOk()
            ->assertJsonPath('data.0.id', $parentId)
            ->assertJsonPath('data.0.title', 'Parent task');

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Child task',
                'list_id' => $listId,
                'parent_task_id' => $parentId,
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Child task')
            ->assertJsonPath('is_parent_task', false)
            ->assertJsonPath('parent_task_id', $parentId);
    }
}
