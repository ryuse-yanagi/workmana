<?php

namespace Tests\Feature\Workspaces;

use App\Models\Organization\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class WorkspaceCreationUsesOrganizationDefaultWorkspaceStatusSettingsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** ステータス省略時は未設定。指定した名前は組織のデフォルト一覧にあるものだけ使える */
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

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated()
            ->assertJsonPath('status', null);

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 2',
                'status' => '運用中',
            ])
            ->assertCreated()
            ->assertJsonPath('status.name', '運用中')
            ->assertJsonPath('status.color_index', 0);
    }
}
