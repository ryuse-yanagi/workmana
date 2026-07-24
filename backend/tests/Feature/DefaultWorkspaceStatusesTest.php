<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use App\Models\Workspace;
use App\Support\DefaultWorkspaceStatuses;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DefaultWorkspaceStatusesTest extends TestCase
{
    use RefreshDatabase;

    public function test_workspace_creation_leaves_status_unset_when_omitted(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated()
            ->assertJsonPath('status', null);

        $workspace = Workspace::query()->first();
        $this->assertNotNull($workspace);
        $this->assertNull($workspace->status);
    }

    public function test_workspace_creation_uses_organization_default_workspace_status_settings(): void
    {
        $user = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_workspace_status_names' => [
                ['name' => '計画中', 'color_index' => 2],
                ['name' => '運用中', 'color_index' => 0],
            ],
        ]);
        $org->members()->attach($user->id, ['role' => 'admin']);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated()
            ->assertJsonPath('status', null);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 2',
                'status' => '運用中',
            ])
            ->assertCreated()
            ->assertJsonPath('status.name', '運用中')
            ->assertJsonPath('status.color_index', 0);
    }

    public function test_admin_can_update_default_workspace_status_settings(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/settings')
            ->assertOk()
            ->assertJsonPath('default_workspace_status_names.0.name', '準備中')
            ->assertJsonPath('default_workspace_status_names.0.color_index', 1)
            ->assertJsonPath('default_workspace_status_names.3.name', '完了')
            ->assertJsonPath('default_workspace_status_names.3.color_index', 5);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson('/api/orgs/acme/settings', [
                'default_workspace_status_names' => [
                    ['name' => '計画中', 'color_index' => 2],
                    ['name' => '運用中', 'color_index' => 0],
                    ['name' => '停止', 'color_index' => 3],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('default_workspace_status_names.0.name', '計画中')
            ->assertJsonPath('default_workspace_status_names.0.color_index', 2)
            ->assertJsonCount(3, 'default_workspace_status_names');
    }

    public function test_workspace_index_includes_status(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
                'status' => '稼働中',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/workspaces')
            ->assertOk()
            ->assertJsonPath('data.0.status.name', '稼働中')
            ->assertJsonPath('data.0.status.color_index', 0);
    }

    public function test_default_workspace_status_items_use_expected_colors(): void
    {
        $this->assertSame([
            ['name' => '準備中', 'color_index' => 1],
            ['name' => '稼働中', 'color_index' => 0],
            ['name' => '保留', 'color_index' => 3],
            ['name' => '完了', 'color_index' => 5],
        ], DefaultWorkspaceStatuses::DEFAULT_ITEMS);
    }
}
