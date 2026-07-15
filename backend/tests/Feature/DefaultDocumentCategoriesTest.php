<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use App\Support\DefaultDocumentCategories;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DefaultDocumentCategoriesTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_update_default_document_category_settings(): void
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
            ->assertJsonPath('default_document_category_names.0.name', 'マニュアル')
            ->assertJsonPath('default_document_category_names.0.color_index', 0)
            ->assertJsonPath('default_document_category_names.2.name', '会議')
            ->assertJsonPath('default_document_category_names.2.color_index', 3);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson('/api/orgs/acme/settings', [
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

    public function test_document_index_includes_resolved_category(): void
    {
        $user = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_document_category_names' => [
                ['name' => 'マニュアル', 'color_index' => 0],
                ['name' => '設計書', 'color_index' => 1],
            ],
        ]);
        $org->members()->attach($user->id, ['role' => 'admin']);

        SharedDocument::query()->create([
            'organization_id' => $org->id,
            'created_by' => $user->id,
            'name' => 'API 設計',
            'category' => '設計書',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonPath('data.0.category.name', '設計書')
            ->assertJsonPath('data.0.category.color_index', 1);
    }

    public function test_default_document_category_items_use_expected_colors(): void
    {
        $this->assertSame([
            ['name' => 'マニュアル', 'color_index' => 0],
            ['name' => '設計書', 'color_index' => 1],
            ['name' => '会議', 'color_index' => 3],
        ], DefaultDocumentCategories::DEFAULT_ITEMS);
    }
}
