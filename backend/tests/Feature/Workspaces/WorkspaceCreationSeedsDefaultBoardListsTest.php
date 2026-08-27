<?php

namespace Tests\Feature\Workspaces;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class WorkspaceCreationSeedsDefaultBoardListsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_workspace_creation_seeds_default_board_lists(): void
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

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/lists")
            ->assertOk()
            ->assertJsonPath('data.0.name', '未着手')
            ->assertJsonPath('data.0.color_index', 0)
            ->assertJsonPath('data.1.name', '進行中')
            ->assertJsonPath('data.1.color_index', 1)
            ->assertJsonPath('data.2.name', '完了')
            ->assertJsonPath('data.2.color_index', 3);
    }
}
