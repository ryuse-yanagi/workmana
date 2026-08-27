<?php

namespace Tests\Feature\Documents;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class DocumentCreationLeavesCategoryUnsetWhenOmittedTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_document_creation_leaves_category_unset_when_omitted(): void
    {
        $user = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_document_category_names' => [
                ['name' => '仕様書', 'color_index' => 1],
                ['name' => 'その他', 'color_index' => 5],
            ],
        ]);
        $org->members()->attach($user->id, ['role' => 'admin']);

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/documents', [
                'name' => '未設定カテゴリの資料',
            ])
            ->assertCreated()
            ->assertJsonPath('category', null);

        $this->assertDatabaseHas('shared_documents', [
            'organization_id' => $org->id,
            'name' => '未設定カテゴリの資料',
            'category' => null,
        ]);
    }
}
