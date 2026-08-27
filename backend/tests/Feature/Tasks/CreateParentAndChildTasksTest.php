<?php

namespace Tests\Feature\Tasks;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CreateParentAndChildTasksTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_user_can_create_parent_and_child_tasks(): void
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
            ->assertCreated()
            ->assertJsonPath('title', 'Parent task')
            ->assertJsonPath('is_parent_task', true)
            ->assertJsonPath('parent_task_id', null);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/parents")
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Parent task');

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Child task',
                'list_id' => $listId,
                'parent_task_id' => 1,
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Child task')
            ->assertJsonPath('is_parent_task', false)
            ->assertJsonPath('parent_task_id', 1);
    }
}
