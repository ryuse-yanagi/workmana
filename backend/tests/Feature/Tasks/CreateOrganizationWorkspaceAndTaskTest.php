<?php

namespace Tests\Feature\Tasks;

use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CreateOrganizationWorkspaceAndTaskTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 組織作成者がワークスペースとタスクを作り、工数を更新できる */
    public function test_user_can_create_organization_workspace_and_task(): void
    {
        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", [
                'name' => 'Sprint 1',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'Sprint 1');

        $workspace = Workspace::query()->first();
        $this->assertNotNull($workspace);

        $taskId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'First task',
                'list_id' => $this->defaultListId($workspace),
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'First task')
            ->json('id');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskId}", [
                'effort_hours' => 8.5,
            ])
            ->assertOk()
            ->assertJsonPath('effort_hours', '8.500000');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskId}", [
                'effort_hours' => 4,
            ])
            ->assertOk()
            ->assertJsonPath('effort_hours', '4.000000');

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks")
            ->assertOk()
            ->assertJsonPath('data.0.effort_hours', '4.000000');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskId}", [
                'description' => 'WBS note',
            ])
            ->assertOk();

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('data.0.description', 'WBS note')
            ->assertJsonPath('data.0.list_name', '未着手');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskId}", [
                'effort_hours' => null,
            ])
            ->assertOk()
            ->assertJsonPath('effort_hours', null);
    }
}
