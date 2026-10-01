<?php

namespace Tests\Feature\Workspaces;

use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class WorkspaceCreationLeavesStatusUnsetWhenOmittedTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** ステータス未指定でワークスペースを作成すると未設定になる */
    public function test_workspace_creation_leaves_status_unset_when_omitted(): void
    {
        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", [
                'name' => 'Sprint 1',
            ])
            ->assertCreated()
            ->assertJsonPath('status', null)
            ->assertJsonPath('assignees', []);

        $workspace = Workspace::query()->first();
        $this->assertNotNull($workspace);
        $this->assertNull($workspace->status);
        $this->assertDatabaseMissing('workspace_assignees', [
            'workspace_id' => $workspace->id,
        ]);
    }
}
