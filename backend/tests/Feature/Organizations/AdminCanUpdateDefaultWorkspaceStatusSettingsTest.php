<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AdminCanUpdateDefaultWorkspaceStatusSettingsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者がデフォルトワークスペースステータス設定を更新できる */
    public function test_admin_can_update_default_workspace_status_settings(): void
    {
        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/settings")
            ->assertOk()
            ->assertJsonPath('default_workspace_status_names.0.name', '準備中')
            ->assertJsonPath('default_workspace_status_names.0.color_index', 1)
            ->assertJsonPath('default_workspace_status_names.3.name', '完了')
            ->assertJsonPath('default_workspace_status_names.3.color_index', 5);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/settings", [
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
}
