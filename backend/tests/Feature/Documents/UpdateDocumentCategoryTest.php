<?php

namespace Tests\Feature\Documents;

use App\Models\Document\Document;
use App\Models\Organization\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UpdateDocumentCategoryTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者は他フィールドを変えずに資料カテゴリだけ更新できる */
    public function test_admin_can_update_document_category_without_changing_name(): void
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
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Docs');

        $document = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $user->id,
            'name' => '設計資料',
            'category' => 'その他',
        ]);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/documents/{$document->id}", [
                'category' => '仕様書',
            ])
            ->assertOk()
            ->assertJsonPath('category.name', '仕様書')
            ->assertJsonPath('name', '設計資料');

        $this->assertDatabaseHas('shared_documents', [
            'id' => $document->id,
            'name' => '設計資料',
            'category' => '仕様書',
        ]);
    }
}
