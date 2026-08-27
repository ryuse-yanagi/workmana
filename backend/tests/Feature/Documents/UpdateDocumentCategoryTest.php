<?php

namespace Tests\Feature\Documents;

use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UpdateDocumentCategoryTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_organization_member_can_update_document_category(): void
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
            'category' => 'その他',
        ]);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/documents/{$document->id}", [
                'category' => '仕様書',
            ])
            ->assertOk()
            ->assertJsonPath('category.name', '仕様書');

        $this->assertDatabaseHas('shared_documents', [
            'id' => $document->id,
            'category' => '仕様書',
        ]);
    }
}
