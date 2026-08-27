<?php

namespace Tests\Feature\Tasks;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CreateOrganizationWorkspaceAndTaskTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_user_can_create_organization_workspace_and_task(): void
    {
        $user = User::factory()->create();

        $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated()
            ->assertJsonPath('slug', 'acme');

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'Sprint 1');

        $workspace = Workspace::query()->first();
        $this->assertNotNull($workspace);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'First task',
                'list_id' => $this->defaultListId($workspace),
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'First task');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/1", [
                'effort_hours' => 8.5,
            ])
            ->assertOk()
            ->assertJsonPath('effort_hours', '8.500000');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/1", [
                'effort_hours' => 4,
            ])
            ->assertOk()
            ->assertJsonPath('effort_hours', '4.000000');

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks")
            ->assertOk()
            ->assertJsonPath('data.0.effort_hours', '4.000000');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/1", [
                'description' => 'WBS note',
            ])
            ->assertOk();

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('data.0.description', 'WBS note')
            ->assertJsonPath('data.0.list_name', '未着手');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/1", [
                'effort_hours' => null,
            ])
            ->assertOk()
            ->assertJsonPath('effort_hours', null);
    }
}
