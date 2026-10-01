<?php

namespace Tests\Feature\Documents;

use App\Models\Organization\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class DocumentCreationLeavesCategoryUnsetWhenOmittedTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** カテゴリ未指定の作成は、組織にデフォルトカテゴリがあっても「その他」へ寄せず null のまま */
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
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Docs');

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/documents', [
                'workspace_id' => $workspaceId,
                'name' => '未設定カテゴリの資料',
            ])
            ->assertCreated()
            ->assertJsonPath('category', null);

        $this->assertDatabaseHas('shared_documents', [
            'organization_id' => $org->id,
            'workspace_id' => $workspaceId,
            'name' => '未設定カテゴリの資料',
            'category' => null,
        ]);
    }
}
