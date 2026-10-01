<?php

namespace Tests\Feature\Workspaces;

use App\Models\Organization\Organization;
use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class WorkspaceCreationUsesOrganizationDefaultBoardListSettingsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** ワークスペース作成時に組織のデフォルトボードリスト設定が使われる */
    public function test_workspace_creation_uses_organization_default_board_list_settings(): void
    {
        $user = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_board_list_names' => ['Backlog', 'Review'],
        ]);
        $org->members()->attach($user->id, ['role' => 'admin']);

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
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Backlog')
            ->assertJsonPath('data.1.name', 'Review');
    }
}
