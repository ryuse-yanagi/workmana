<?php

namespace Tests\Feature\Documents;

use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UpdateSharedDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_organization_member_can_update_shared_document(): void
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_document_category_names' => [
                ['name' => '仕様書', 'color_index' => 1],
                ['name' => 'その他', 'color_index' => 5],
            ],
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => '設計資料',
            'description' => '旧説明',
            'category' => 'その他',
        ]);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/documents/{$document->id}", [
                'name' => '更新後の資料',
                'description' => '新説明',
                'body' => '更新後の本文',
                'category' => '仕様書',
                'label_ids' => [],
            ])
            ->assertOk()
            ->assertJsonPath('name', '更新後の資料')
            ->assertJsonPath('description', '新説明')
            ->assertJsonPath('body', '更新後の本文')
            ->assertJsonPath('category.name', '仕様書');

        $this->assertDatabaseHas('shared_documents', [
            'id' => $document->id,
            'name' => '更新後の資料',
            'description' => '新説明',
            'body' => '更新後の本文',
            'category' => '仕様書',
        ]);
    }
}
