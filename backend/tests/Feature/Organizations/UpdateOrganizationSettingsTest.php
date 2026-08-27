<?php

namespace Tests\Feature\Organizations;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UpdateOrganizationSettingsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_organization_settings_can_be_updated(): void
    {
        [$admin] = $this->createOrgWithAdminAndMember();

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/settings')
            ->assertOk()
            ->assertJsonStructure([
                'default_board_list_names',
                'default_workspace_status_names',
                'default_document_category_names',
            ]);

        $this->actingAsApiUser($admin)
            ->patchJson('/api/orgs/acme/settings', [
                'default_workspace_status_names' => [
                    ['name' => '準備中', 'color_index' => 1],
                    ['name' => '稼働中', 'color_index' => 0],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('default_workspace_status_names.0.name', '準備中')
            ->assertJsonPath('default_workspace_status_names.1.name', '稼働中');
    }
}
