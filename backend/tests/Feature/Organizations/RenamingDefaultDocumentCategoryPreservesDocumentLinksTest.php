<?php

namespace Tests\Feature\Organizations;

use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class RenamingDefaultDocumentCategoryPreservesDocumentLinksTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_renaming_default_document_category_preserves_document_links(): void
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
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Docs space');

        $documentId = (int) SharedDocument::query()->create([
            'organization_id' => $org->id,
            'workspace_id' => $workspaceId,
            'created_by' => $user->id,
            'name' => 'API 設計',
            'category' => '設計書',
        ])->id;

        $this->actingAsApiUser($user)
            ->patchJson('/api/orgs/acme/settings', [
                'default_document_category_names' => [
                    ['name' => 'マニュアル', 'color_index' => 0],
                    ['name' => '仕様書', 'color_index' => 1],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('default_document_category_names.1.name', '仕様書');

        $this->assertSame('仕様書', SharedDocument::query()->findOrFail($documentId)->category);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/documents")
            ->assertOk()
            ->assertJsonPath('data.0.category.name', '仕様書')
            ->assertJsonPath('data.0.category.color_index', 1);
    }

    public function test_deleting_default_document_category_clears_document_links(): void
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
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Docs space');

        $documentId = (int) SharedDocument::query()->create([
            'organization_id' => $org->id,
            'workspace_id' => $workspaceId,
            'created_by' => $user->id,
            'name' => 'API 設計',
            'category' => '設計書',
        ])->id;

        $this->actingAsApiUser($user)
            ->patchJson('/api/orgs/acme/settings', [
                'default_document_category_names' => [
                    ['name' => 'マニュアル', 'color_index' => 0],
                ],
            ])
            ->assertOk();

        $this->assertNull(SharedDocument::query()->findOrFail($documentId)->category);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/documents")
            ->assertOk()
            ->assertJsonPath('data.0.category', null);
    }
}

