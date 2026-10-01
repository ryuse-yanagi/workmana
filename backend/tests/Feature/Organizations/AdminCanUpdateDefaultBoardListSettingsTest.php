<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AdminCanUpdateDefaultBoardListSettingsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者がデフォルトボードリスト設定を更新できる */
    public function test_admin_can_update_default_board_list_settings(): void
    {
        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/settings")
            ->assertOk()
            ->assertJsonPath('default_board_list_names.0.name', '未着手')
            ->assertJsonPath('default_board_list_names.0.color_index', 0)
            ->assertJsonPath('default_board_list_names.2.name', '完了')
            ->assertJsonPath('default_board_list_names.2.color_index', 3);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/settings", [
                'default_board_list_names' => [
                    ['name' => 'To Do', 'color_index' => 5],
                    ['name' => 'Doing', 'color_index' => 1],
                    ['name' => 'Done', 'color_index' => 3],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('default_board_list_names.0.name', 'To Do')
            ->assertJsonPath('default_board_list_names.0.color_index', 5)
            ->assertJsonPath('default_board_list_names.2.color_index', 3);
    }

    /** デフォルトボードリストは1件以上必須 */
    public function test_default_board_list_settings_require_at_least_one_list(): void
    {
        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/settings", [
                'default_board_list_names' => [
                    ['name' => 'To Do', 'color_index' => 5],
                ],
            ])
            ->assertOk()
            ->assertJsonCount(1, 'default_board_list_names')
            ->assertJsonPath('default_board_list_names.0.name', 'To Do');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/settings", [
                'default_board_list_names' => [],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['default_board_list_names']);
    }
}
