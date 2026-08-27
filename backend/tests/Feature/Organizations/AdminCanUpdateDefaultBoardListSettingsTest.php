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

    public function test_admin_can_update_default_board_list_settings(): void
    {
        $user = User::factory()->create();

        $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/settings')
            ->assertOk()
            ->assertJsonPath('default_board_list_names.0.name', '未着手')
            ->assertJsonPath('default_board_list_names.0.color_index', 0)
            ->assertJsonPath('default_board_list_names.2.name', '完了')
            ->assertJsonPath('default_board_list_names.2.color_index', 3);

        $this->actingAsApiUser($user)
            ->patchJson('/api/orgs/acme/settings', [
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
}
