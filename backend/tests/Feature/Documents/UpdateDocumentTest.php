<?php

namespace Tests\Feature\Documents;

use App\Models\Document\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UpdateDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者が資料の内容を更新できる */
    public function test_admin_can_update_shared_document(): void
    {
        [$admin, $organization] = $this->createOrgWithAdminAndMember();
        $workspaceId = $this->createWorkspaceViaApi($admin, 'acme', 'Docs');

        $document = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $admin->id,
            'name' => '設計資料',
            'description' => '旧説明',
            'category' => 'その他',
        ]);

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/documents/{$document->id}", [
                'name' => '更新後の資料',
                'description' => '新説明',
                'body' => '更新後の本文',
                'category' => 'その他',
            ])
            ->assertOk()
            ->assertJsonPath('name', '更新後の資料')
            ->assertJsonPath('description', '新説明')
            ->assertJsonPath('body', '更新後の本文')
            ->assertJsonPath('category.name', 'その他');

        $this->assertDatabaseHas('shared_documents', [
            'id' => $document->id,
            'name' => '更新後の資料',
            'description' => '新説明',
            'body' => '更新後の本文',
            'category' => 'その他',
        ]);
    }
}
