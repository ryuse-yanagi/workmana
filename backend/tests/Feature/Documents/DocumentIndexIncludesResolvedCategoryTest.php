<?php

namespace Tests\Feature\Documents;

use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class DocumentIndexIncludesResolvedCategoryTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

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

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonPath('data.0.category.name', '設計書')
            ->assertJsonPath('data.0.category.color_index', 1);
    }
}
