<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AdminCanUpdateDefaultDocumentCategorySettingsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者がデフォルト資料カテゴリ設定を更新できる */
    public function test_admin_can_update_default_document_category_settings(): void
    {
        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/settings")
            ->assertOk()
            ->assertJsonPath('default_document_category_names.0.name', 'その他')
            ->assertJsonPath('default_document_category_names.0.color_index', 5)
            ->assertJsonCount(1, 'default_document_category_names');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/settings", [
                'default_document_category_names' => [
                    ['name' => '仕様書', 'color_index' => 2],
                    ['name' => '議事録', 'color_index' => 5],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('default_document_category_names.0.name', '仕様書')
            ->assertJsonPath('default_document_category_names.0.color_index', 2)
            ->assertJsonCount(2, 'default_document_category_names');
    }
}
